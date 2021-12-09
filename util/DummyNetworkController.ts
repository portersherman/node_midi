import {NetworkController} from "./NetworkController";

export class DummyNetworkController implements NetworkController{
    get(url: string) {
        console.log(`GET to ${url}`);

        return {
            0: {
                name: "light0",
                capabilities: ["color"]
            },
            1: {
                name: "light1",
                capabilities: ["color"]
            },
            2: {
                name: "light2",
                capabilities: ["color"]
            },
            3: {
                name: "light3",
                capabilities: []
            },
        };
    }

    put(url: string, data: object) {
        console.log(`PUT to ${url} with`, data);

        return Promise.resolve();
    }
}