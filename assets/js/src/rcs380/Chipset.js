import { Frame } from "./Frame.js";
import { comp, s2a, hex } from "../common.js";

const ACK = s2a("0000FF00FF00");
const CMD = {
  0x00: "InSetRF",
  0x02: "InSetProtocol",
  0x04: "InCommRF",
  0x06: "SwitchRF",
  0x10: "MaintainFlash",
  0x12: "ResetDevice",
  0x20: "GetFirmwareVersion",
  0x22: "GetPDDataVersion",
  0x24: "GetProperty",
  0x26: "InGetProtocol",
  0x28: "GetCommandType",
  0x2A: "SetCommandType",
  0x30: "InSetRCT",
  0x32: "InGetRCT",
  0x34: "GetPDData",
  0x36: "ReadRegister",
  0x40: "TgSetRF",
  0x42: "TgSetProtocol",
  0x44: "TgSetAuto",
  0x46: "TgSetRFOff",
  0x48: "TgCommRF",
  0x50: "TgGetProtocol",
  0x60: "TgSetRCT",
  0x62: "TgGetRCT",
  0xF0: "Diagnose",
};

const ERROR_STATUS = {
  0: "SUCCESS",
  1: "PARAMETER_ERROR",
  2: "PB_ERROR",
  3: "RFCA_ERROR",
  4: "TEMPERATURE_ERROR",
  5: "PWD_ERROR",
  6: "RECEIVE_ERROR",
  7: "COMMANDTYPE_ERROR",
};

export class Chipset {
  constructor(usb) {
    this.usb = usb;
  }
  async connect() {
    return new Promise( async (resolve, reject) => {
      const { usb } = this;

      let count = 0;
      try {
        await this.usb.reset();
        await this.set_command_type(1);
        await this.get_firmware_version();
        await this.get_pd_data_version();
        await this.switch_rf("off");
        resolve();
      } catch (err) {
        throw err;
      }
    });
  }
  async disconnect() {
    return new Promise( async (resolve, reject) => {
      if (this.usb) {
        await this.switch_rf("off");
        await this.usb.send(ACK);

        this.usb = null;
      }
      resolve();
    });
  }

  async set_command_type(command_type) {
    return new Promise( async (resolve, reject) => {

      const data = await this.send_command(0x2A, [command_type]);
      if (data && data[0] !== 0) {
        reject(new TypeError(data[0]));
      } else {
        resolve();
      }
    });
  }
  async get_firmware_version() {
    return new Promise( async (resolve, reject) => {

      const data = await this.send_command(0x20);
      console.log(`firmware version ${data[1]}.${data[0]}`);
      resolve(data);
    });
  }
  async get_pd_data_version() {
    return new Promise( async (resolve, reject) => {

      const data = await this.send_command(0x22);
      console.log(`ackage data format ${data[1]}.${data[0]}`);
      resolve();
    });
  }
  async switch_rf(type) { // @arg String - "on" / "off"
    return new Promise( async (resolve, reject) => {

      const data = await this.send_command(0x06, [type === "off" ? 0 : 1]);
      if (data && data[0] !== 0) {
        reject(new Error(ERROR_STATUS[data[0]]));
      } else {
        resolve();
      }
    });
  }

  async send_command(cmd_code, cmd_data = []) {
    return new Promise( async (resolve, reject) => {

      const cmd = [0xD6].concat(cmd_code, cmd_data);
      const frame = new Frame(cmd);
      await this.usb.send(frame.frame);

      const ack = new Frame(await this.usb.recv());

      if (ack.type === "ack") {
        const resp = new Frame(await this.usb.recv());
        if (resp.type == "data") {
          if (resp.data[0] === 0xD7 && resp.data[1] === cmd_code + 1) {
            resolve( resp.data.slice(2) );
          } else {
            reject( new Error(`expected response code 0xD7 ${cmd_code+1} is not ${resp.data[0]}${resp.data[1]}`) );
          }
        }
      }
    });
  }

  async in_set_rf(brty_send, brty_recv = undefined) {
    return new Promise( async (resolve, reject) => {
      const settings = {
        "212F": [1, 1, 15, 1], "424F": [1, 2, 15, 2],
        "106A": [2, 3, 15, 3], "212A": [4, 4, 15, 4],
        "424A": [5, 5, 15, 5], "106B": [3, 7, 15, 7],
        "212B": [3, 8, 15, 8], "424B": [3, 9, 15, 9],
      };
      if (brty_recv === undefined) {
        brty_recv = brty_send;
      }
      const data = [].concat( settings[brty_send].slice(0, 2),
                              settings[brty_recv].slice(2, 4) );
      const resp = await this.send_command(0x00, data);
      if (resp && resp[0] !== 0) {
        reject(new Error(ERROR_STATUS[data[0]]));
      } else {
        resolve(resp);
      }
    });
  }

  async in_set_protocol(data = []) {

    if (!Array.isArray(data)) {
      throw new TypeError(`Invalid arg: ${data}`);
    }
    return new Promise( async (resolve, reject) => {
      if (data.length) {
        const resp = await this.send_command(0x02, data);
        if (resp && resp[0] !== 0) {
          reject(new Error(ERROR_STATUS[resp[0]]));
        } else {
          resolve(resp);
        }
      }
    });
  }

  async in_comm_rf(data, timeout = 0) {
    return new Promise( async (resolve, reject) => {
      if (timeout) {
        timeout = Math.min((timeout + 1 ) * 10, 0xFFFF); // cap
      }
      const a = [timeout & 0xFF, (timeout >> 8) & 0xFF].concat(data);
      const resp = await this.send_command(0x04, a);
      const code = resp.slice(0, 4);

      //console.log(hex(code));

/*
      if (resp && code !== 0) {
        reject(new Error(ERROR_COMMUNICATION[code]));
      } else {
        resolve(resp.slice(5));
      }
 */
      if (resp && !comp(code, "00000000")) {
        resolve({ ok: false, data: code });
      } else {
        resolve({ ok: true, data: resp.slice(5) });
      }
    });
  }
}

