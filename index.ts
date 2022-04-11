import { AxiosWrapper } from "./util/AxiosWrapper";
import { DummyNetworkController } from "./util/DummyNetworkController";
const midi = require("easymidi");
const prompt = require("prompt-sync")({ sigInt: true });
import { HueHandler } from "./lib/HueHandler";
import { Handler } from "./lib/Handler";
import * as http from "http";

const startMidiListener = async (handler) => {
    let inputs = midi.getInputs();

    for (let i: number = 0; i < inputs.length; i++) {
        console.log(i, ":", inputs[i].toString());
    }

    if (inputs.length < 1) {
        throw new Error("please connect a midi device and restart application");
    } else {
        const inputIndex: number = parseInt(prompt("select port [0-" + (inputs.length - 1) + "]: "));
        const input = new midi.Input(inputs[inputIndex].toString());

        input.on("cc", (message) => {
            message.channel += 1;
            handler.handleCC(message);
        });

        input.on("program", (message) => {
            message.channel += 1;
            handler.handlePC(message);
        });

        return input.name;
    }
}

// set up Handler

let handler: Handler;
let filepath: string;

if (process.env.FABRIC === "LOCAL") {
    console.log("local debugging session detected");
    filepath = __dirname + "/config-local.json";
    handler = new HueHandler(new DummyNetworkController(), filepath);
} else {
    filepath = __dirname + "/config.json";
    handler = new HueHandler(new AxiosWrapper(), filepath);
}

handler.setup().then(() => {
    startMidiListener(handler).then((inputName: string) => {
        console.log(`listening for MIDI from ${inputName}`);
        http.createServer().listen();
    }).catch((error) => {
        console.log(error);
    });
}).catch(error => {
    console.log(error);
});