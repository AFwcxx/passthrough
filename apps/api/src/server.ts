import { join } from "node:path";
import express from "express";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
const config=loadConfig(),{app,db}=createApp(config),web=join(import.meta.dirname,"../../web/dist");
app.use(express.static(web)); app.get("*splat",(_req,res)=>res.sendFile(join(web,"index.html")));
const server=app.listen(config.PORT,"0.0.0.0",()=>console.log(JSON.stringify({level:"info",message:"listening",port:config.PORT})));
for(const signal of ["SIGINT","SIGTERM"]){process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}));}
