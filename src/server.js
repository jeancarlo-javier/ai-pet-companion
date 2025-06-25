import express from 'express'
import talkPet from './services/pet.js'
import 'dotenv/config'

const app = express()

app.use(express.json())
app.use(express.static('public'))

app.post("/chat", async (req, res) => {
  const { userMsg } = req.body

  if (!userMsg) res.json({ "message": "userMsg is required" })

  const petResponse = await talkPet(userMsg)

  res.json({
    "message": petResponse
  })
})

app.listen(process.env.PORT, () => {
  console.log(`Express listening on port: ${process.env.PORT}`)
})

