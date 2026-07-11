// import { build } from "bun";
import { buildApp } from "./app";
import { playerRoutes } from "./routes/players";
import { roomRoutes } from "./routes/rooms";
import { gameSocketRoutes } from "./ws/gamesocket";
const app = await buildApp()

await app.register(playerRoutes)
await app.register(roomRoutes)
await app.register(gameSocketRoutes)

app.listen({port : 7000, host : "0.0.0.0"}, (err)=>{
  if(err){
    app.log.error(err)
    process.exit(1)
  }
  console.log('server listening on port 7000')
})

