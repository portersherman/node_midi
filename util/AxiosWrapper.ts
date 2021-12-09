import {NetworkController} from "./NetworkController";
import axios from "axios";

export class AxiosWrapper implements NetworkController {
    get(url: string) {
        return axios.get(url);
    }

    put(url: string, data: object) {
        return axios.put(url, data);
    }
}