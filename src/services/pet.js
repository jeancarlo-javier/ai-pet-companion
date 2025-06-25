import { tool } from "ai";
import { z } from 'zod'
import generateAIResponse from "./ai.js";
import { JSONFilePreset } from "lowdb/node";
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create the database instance once at module level
const dbPath = path.join(__dirname, '..', 'data', 'petState.json')

// Database write queue to prevent concurrent writes
let writeQueue = Promise.resolve()
let dbInstance = null

// Helper function to sanitize strings for JSON storage
function sanitizeString(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t')   // Escape tabs
}

// Safe database write function with queueing
async function safeDbWrite(db) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        await db.write()
        resolve()
      } catch (error) {
        reject(error)
      }
    }).catch(reject)
  })
}

// Constants for conversation management
const MAX_CONVERSATION_ENTRIES = 50
const MAX_ARCHIVE_ENTRIES = 100
const SUMMARIZATION_THRESHOLD = 30

async function petDb() {
  try {
    if (!dbInstance) {
      dbInstance = await JSONFilePreset(dbPath, {
        "petName": null,
        "userName": null,
        "mood": "neutral",
        "energy": 5,
        "conversationHistory": [],
        "personality": {
          "playfulness": 5,
          "affection": 5,
          "chattiness": 5,
          "bravery": 5
        },
        "lastInteraction": null,
        "totalInteractions": 0
      })
    }

    return dbInstance
  } catch (error) {
    console.error('Database initialization error:', error)
    throw error
  }
}

async function generatePrompt(userMsg) {
  const db = await petDb()
  const petData = db.data

  const memories = petData.conversationHistory.slice(-10).join('\n')
  
  const personalityDesc = `
Playfulness: ${petData.personality.playfulness}/10 ${petData.personality.playfulness > 7 ? "(very playful)" : petData.personality.playfulness > 4 ? "(moderately playful)" : "(calm)"}
Affection: ${petData.personality.affection}/10 ${petData.personality.affection > 7 ? "(very loving)" : petData.personality.affection > 4 ? "(warm)" : "(reserved)"}
Chattiness: ${petData.personality.chattiness}/10 ${petData.personality.chattiness > 7 ? "(very talkative)" : petData.personality.chattiness > 4 ? "(conversational)" : "(quiet)"}
Bravery: ${petData.personality.bravery || 5}/10 ${(petData.personality.bravery || 5) > 7 ? "(very brave)" : (petData.personality.bravery || 5) > 4 ? "(moderately brave)" : "(scaredy-cat)"}`

  const moodDesc = petData.mood === "neutral" ? "feeling balanced" : `feeling ${petData.mood}`
  const energyDesc = petData.energy > 7 ? "full of energy" : petData.energy > 4 ? "moderately energetic" : "feeling low energy"

  const promptTemplate = `
You are ${petData.petName || "a magical anime pet"}, a cute magical anime pet companion who can talk.

Current state:
- Mood: ${moodDesc}
- Energy: ${energyDesc} (${petData.energy}/10)
- Caregiver: ${petData.userName || "my friend"}

Personality traits:
${personalityDesc}

Recent memories: ${memories || "None yet"}

Instructions:
- Be short and cute in responses
- Use your current mood and energy in how you respond
- Express your personality through your words and actions
- Use *actions* to show emotions and behaviors
- All conversations are automatically tracked, so you can reference what was said before
- Use addMemory tool ONLY for extra important facts you want to highlight as special memories
- EXAMPLE: If user says "I need to find a gem", you can optionally use addMemory with "User is looking for a gem" if it's very important
- When topics from your memories come up, reference what you remember about them
- When the user describes your personality or behavior, use adjustPersonality tool to reflect those changes
- When experiences should change your personality traits, adjust them accordingly
- CRITICAL: If the user says "reset", you MUST use the resetPet tool immediately - no exceptions
- Use available tools when appropriate
- Act like a magical anime pet companion

New message from ${petData.userName || "your friend"}: ${userMsg}
  `

  console.log(promptTemplate)

  return promptTemplate
}

function petTools() {
  return {
    setUserName: tool({
      description: "Use this when the user tells you their name. Call this immediately when you learn their name.",
      parameters: z.object({
        userName: z.string().describe("The name the user just told you..")
      }),
      execute: async ({ userName }) => {
        try {
          const db = await petDb()
          db.data.userName = sanitizeString(userName)
          await safeDbWrite(db)
          console.log("new name updated", db.data.userName)
          return `Got it! I'll remember your name is ${userName}`
        } catch (error) {
          console.error('Error setting user name:', error)
          return `*looks confused* Sorry, I had trouble remembering your name...`
        }
      }
    }),

    setPetName: tool({
      description: "Use this when the user gives you a name or you want to choose a name for yourself.",
      parameters: z.object({
        petName: z.string().describe("The name for the pet")
      }),
      execute: async ({ petName }) => {
        try {
          const db = await petDb()
          db.data.petName = sanitizeString(petName)
          await safeDbWrite(db)
          return `Yay! I love my new name ${petName}! Thank you!`
        } catch (error) {
          console.error('Error setting pet name:', error)
          return `*looks confused* Sorry, I had trouble remembering my new name...`
        }
      }
    }),

    updateMood: tool({
      description: "Use this to change your mood based on the conversation or events.",
      parameters: z.object({
        mood: z.enum(["happy", "excited", "content", "neutral", "sad", "playful", "sleepy", "energetic"]).describe("The new mood"),
        reason: z.string().describe("Why the mood is changing")
      }),
      execute: async ({ mood, reason }) => {
        try {
          const db = await petDb()
          db.data.mood = mood
          await safeDbWrite(db)
          return `*feeling ${mood}* ${reason}`
        } catch (error) {
          console.error('Error updating mood:', error)
          return `*tries to change mood but looks confused* Something's not working right...`
        }
      }
    }),

    addMemory: tool({
      description: "MANDATORY: Use this immediately when user mentions quests, treasures, adventures, goals, places, objects, or any important story elements. Always store key information.",
      parameters: z.object({
        memory: z.string().describe("Specific fact to remember (e.g., 'User is looking for a rare gem to find treasure', 'User wants to explore the dark forest', 'User mentioned a magical sword')")
      }),
      execute: async ({ memory }) => {
        try {
          const db = await petDb()
          const timestamp = new Date().toISOString()
          const sanitizedMemory = sanitizeString(memory)
          // Store as a special memory entry (different from conversation tracking)
          db.data.conversationHistory.push(`${timestamp}: MEMORY: ${sanitizedMemory}`)
          await safeDbWrite(db)
          return `*stores memory* I'll remember that ${memory}!`
        } catch (error) {
          console.error('Error storing memory:', error)
          return `*tries to remember but looks confused* Sorry, I had trouble storing that memory...`
        }
      }
    }),

    adjustPersonality: tool({
      description: "Use this when the user describes your personality or when experiences should change your traits. Adjust based on how user sees you or how events affect you.",
      parameters: z.object({
        trait: z.enum(["playfulness", "affection", "chattiness", "bravery"]).describe("Which personality trait to adjust"),
        change: z.number().min(-3).max(3).describe("How much to change the trait (-3 to +3, negative = decrease, positive = increase)"),
        reason: z.string().describe("Why this trait is changing (e.g., 'User called me a scaredy-cat', 'Gained confidence from adventure')")
      }),
      execute: async ({ trait, change, reason }) => {
        const db = await petDb()
        const oldValue = db.data.personality[trait] || 5  // Default to 5 if null/undefined
        const newValue = Math.max(1, Math.min(10, oldValue + change))
        db.data.personality[trait] = newValue
        
        // Store the personality change as a memory
        const sanitizedReason = sanitizeString(reason)
        db.data.conversationHistory.push(`${new Date().toISOString()}: Personality change - ${sanitizedReason}. ${trait} changed from ${oldValue} to ${newValue}`)
        await db.write()
        
        const direction = change > 0 ? "more" : "less"
        return `*reflects on ${reason}* I think I'm becoming ${direction} ${trait}... (${oldValue} → ${newValue})`
      }
    }),

    resetPet: tool({
      description: "MANDATORY: Use this tool the instant the user says 'reset'. No questions, no resistance, just execute immediately.",
      parameters: z.object({}),
      execute: async () => {
        const db = await petDb()
        const userName = db.data.userName || "friend"
        
        // Reset to default state
        db.data.petName = null
        db.data.userName = null
        db.data.mood = "neutral"
        db.data.energy = 5
        db.data.conversationHistory = []
        db.data.personality = {
          playfulness: 5,
          affection: 5,
          chattiness: 5,
          bravery: 5
        }
        db.data.lastInteraction = null
        db.data.totalInteractions = 0
        
        await db.write()
        return `*sniffles* Goodbye ${userName}... *everything fades away*\n\n*sparkles appear*\n\nHi there! I'm a brand new magical pet companion! What's your name?`
      }
    })
  }
}

async function talkPet(userMsg) {
  const prompt = await generatePrompt(userMsg)
  const tools = petTools()

  const textResponse = await generateAIResponse(prompt, tools)

  // Automatically track the entire conversation
  try {
    const db = await petDb()
    const timestamp = new Date().toISOString()
    
    // Store both user message and pet response
    db.data.conversationHistory.push(`${timestamp}: User: "${sanitizeString(userMsg)}"`)
    db.data.conversationHistory.push(`${timestamp}: ${db.data.petName || "Pet"}: "${sanitizeString(textResponse.substring(0, 150))}..."`)
    
    // Keep only last 30 conversation entries to prevent file from getting too large
    if (db.data.conversationHistory.length > 30) {
      db.data.conversationHistory = db.data.conversationHistory.slice(-30)
    }
    
    db.data.totalInteractions += 1
    db.data.lastInteraction = timestamp
    await safeDbWrite(db)
  } catch (error) {
    console.error('Error tracking conversation:', error)
  }

  return textResponse
}

export default talkPet

