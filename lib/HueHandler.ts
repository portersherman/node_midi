import { ControlChange, Program } from "easymidi";
import { Handler } from "./Handler";
import { NetworkController } from "../util/NetworkController";
import * as fs from "fs";
import { rgbToHsv } from "../util/ColorUtil";
const prompt = require("prompt-sync")({ sigInt: true });

const PARAMETERS: { [name: string]: Parameter } = {
    R: "r",
    G: "g",
    B: "b"
};

type Light = {
    name: string,
    r: number,
    g: number,
    b: number
}

type Parameter = string;
type ParameterTuple = {
    id: string,
    parameter: Parameter
}

type Config = {
    ip: string,
    username: string,
    metadata: object,
    midiChannel: number,
    parameterMap: { [cc: number]: Array<ParameterTuple> }
}

export class HueHandler implements Handler {
    filepath: string = null;
    config: Config = null;
    lights: { [id: string]: Light } = {};
    networkController: NetworkController = null;

    constructor(networkController: NetworkController, filepath: string) {
        this.networkController = networkController;
        this.filepath = filepath;

        try {
            this.config = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
        } catch (error) {
            this.log("no config found, re-initializing");
        }
    }

    handleCC = async (message: ControlChange) => {
        if (this.config === null) {
            throw new Error("hue handler not initialized");
        }

        if (Object.keys(this.lights).length === 0) {
            throw new Error("no lights to control");
        }

        if (message.channel !== this.config.midiChannel) {
            return;
        }

        if (!Object.keys(this.config.parameterMap).includes(message.controller.toString())) {
            this.log("cc not present in parameterMap");
            return;
        }

        let parameterTuples: Array<ParameterTuple> = this.config.parameterMap[message.controller.toString()];

        for (let i = 0; i < parameterTuples.length; i++) {
            let parameterTuple: ParameterTuple = parameterTuples[i];

            this.log(`setting ${parameterTuple.parameter} for light ${parameterTuple.id} to ${message.value}`);

            this.lights[parameterTuple.id][parameterTuple.parameter] = message.value;
        }

        this.log(message);
    }

    handlePC = async (message: Program) => {
        if (this.config === null) {
            throw new Error("hue handler not initialized");
        }

        if (Object.keys(this.lights).length === 0) {
            throw new Error("no lights to control");
        }

        if (message.channel !== this.config.midiChannel && message.number !== 0) {
            return;
        }

        this.log(message);

        this.broadcast();
    }

    broadcast = () => {
        Object.keys(this.lights).forEach(id => {
            let light: Light = this.lights[id];

            if (light.r === light.g && light.g === light.b) {
                light.g *= .8;
                light.b *= .5;
            }

            let hsv = rgbToHsv(light.r, light.g, light.b);

            this.networkController.put(`http://${this.config.ip}/api/${this.config.username}/lights/${id}/state`, {
                on: hsv.bri !== 0,
                hue: hsv.hue,
                sat: hsv.sat,
                bri: hsv.bri
            });
        });
    }

    setup = async () => {
        let initialize: boolean = true;

        if (this.isConfigValid(this.config)) {
            initialize = prompt("loaded config from file--would you like to overwrite? (yes/no): ") === "yes";
        }

        if (initialize) {
            const hubIp: string = !!process.env.HUB_IP ?
                process.env.HUB_IP :
                prompt("enter IP address of Hue Hub: ");

            const username: string = !!process.env.USERNAME ?
                process.env.USERNAME :
                prompt("enter username for Hue: ");

            let midiChannel: number = -1;

            while (midiChannel < 1 || midiChannel > 16) {
                midiChannel = parseInt(prompt(`enter MIDI channel [1-16] for lights: `));
            }

            let response: object;

            try {
                response = (await this.networkController.get(`http://${hubIp}/api/${username}/lights`))["data"];

                Object.keys(response).forEach(id => {

                    if (Object.keys(response[id.toString()].capabilities.control).includes("colorgamut")) {
                        this.lights[id] = {
                            name: response[id].name,
                            r: 127,
                            g: 127,
                            b: 127
                        };
                    }
                });
            } catch (error) {
                throw new Error(`there was an error fetching Hue system metadata ${error}`);
            }

            let parameterMap: { [cc: number]: Array<ParameterTuple> } = {};

            Object.keys(this.lights).forEach(id => {
                let ccNumberR: number = parseInt(prompt(`enter CC number for light R-intensity ${this.lights[id].name}: `));
                let rParameterTuple = {
                    id: id,
                    parameter: PARAMETERS.R
                };

                if (ccNumberR in parameterMap) {
                    parameterMap[ccNumberR].push(rParameterTuple);
                } else {
                    parameterMap[ccNumberR] = new Array<ParameterTuple>(rParameterTuple)
                }

                let ccNumberG: number =  parseInt(prompt(`enter CC number for light G-intensity ${this.lights[id].name}: `));
                let gParameterTuple = {
                    id: id,
                    parameter: PARAMETERS.G
                };

                if (ccNumberG in parameterMap) {
                    parameterMap[ccNumberG].push(gParameterTuple);
                } else {
                    parameterMap[ccNumberG] = new Array<ParameterTuple>(gParameterTuple)
                }

                let ccNumberB: number =  parseInt(prompt(`enter CC number for light B-intensity ${this.lights[id].name}: `));
                let bParameterTuple = {
                    id: id,
                    parameter: PARAMETERS.B
                };

                if (ccNumberB in parameterMap) {
                    parameterMap[ccNumberB].push(bParameterTuple);
                } else {
                    parameterMap[ccNumberB] = new Array<ParameterTuple>(bParameterTuple)
                }
            });

            this.config = {
                ip: hubIp,
                username: username,
                metadata: response,
                midiChannel: midiChannel,
                parameterMap: parameterMap
            }

            let json: string = JSON.stringify(this.config);

            try {
                this.log(`writing file to ${this.filepath}`);
                fs.writeFileSync(this.filepath, json, "utf8");
            } catch (error) {
                this.log(error);
            }
        } else {
            Object.keys(this.config.metadata).forEach(id => {
                if (Object.keys(this.config.metadata[id].capabilities.control).includes("colorgamut")) {
                    this.lights[id] = {
                        name: this.config.metadata[id].name,
                        r: 127,
                        g: 127,
                        b: 127
                    };
                }
            });
        }

        return;
    }

    isConfigValid = (handlerConfig: object) => {
        return (handlerConfig !== null
            && "ip" in handlerConfig
            && "username" in handlerConfig
            && "metadata" in handlerConfig
            && "midiChannel" in handlerConfig
            && "parameterMap" in handlerConfig);
    }

    log = (message: any) => {
        console.log("HueHandler:", message);
    }
}

module.exports = { HueHandler };