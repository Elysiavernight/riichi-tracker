import fastify from "fastify";
import websocket  from "@fastify/websocket";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import {
    jsonSchemaTransform,
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
} from "fastify-type-provider-zod"

export async function buildApp(){
    const app = fastify({logger:true}).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    await app.register(cors,{origin:'*'})
    await app.register(websocket)
    await app.register(swagger, {
    openapi: {
      info: {
        title: "Riichi Mahjong Score Tracker API",
        description:
          "REST + WebSocket API for managing players, rooms and live game scoring",
        version: "1.0.0",
      },
      servers: [
        { url: "http://localhost:7000", description: "Local dev server" },
      ],
      tags: [
        { name: "players", description: "Player registration and login" },
        {
          name: "rooms",
          description: "Room lifecycle: create, join, ready up, start",
        },
      ],
    },
    transform: jsonSchemaTransform,
  });
 
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
 
  return app;

}

