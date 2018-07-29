import { WebUSBDevice } from "./rcs380/WebUSBDevice.js";
import { Chipset } from "./rcs380/Chipset.js";
import { comp, hex, sleep, s2a, range, xor } from "./common.js";

const INITIAL_GUARD_TIME      = 0;
const ADD_CRC                 = 1;
const CHECK_CRC               = 2;
const MULTI_CARD              = 3;
const ADD_PARITY              = 4;
const CHECK_PARITY            = 5;
const BITWISE_ANTICOLL        = 6;
const LAST_BYTE_BIT_COUNT     = 7;
const MIFARE_CRYPTO           = 8;
const ADD_SOF                 = 9;
const CHECK_SOF               = 10;
const ADD_EOF                 = 11;
const CHECK_EOF               = 12;
const RFU                     = 13;
const DEAF_TIME               = 14;
const CONTINUOUS_RECEIVE_MODE = 15;
const MIN_LEN_FOR_CRM         = 16;
const TYPE_1_TAG_RRDD         = 17;
const RFCA                    = 18;
const GUARD_TIME              = 19;

const ERROR_COMMUNICATION = {
  "0x00000000": "NO_ERROR",
  "0x00000001": "PROTOCOL_ERROR",
  "0x00000002": "PARITY_ERROR",
  "0x00000004": "CRC_ERROR",
  "0x00000008": "COLLISION_ERROR",
  "0x00000010": "OVERFLOW_ERROR",
  "0x00000040": "TEMPERATURE_ERROR",
  "0x00000080": "RECEIVE_TIMEOUT_ERROR",
  "0x00000100": "CRYPTO1_ERROR",
  "0x00000200": "RFCA_ERROR",
  "0x00000400": "RF_OFF_ERROR",
  "0x00000800": "TRANSMIT_TIMEOUT_ERROR",
  "0x80000000": "RECEIVE_LENGTH_ERROR"
};

export class RCS380 {
  constructor() {
    this._usb = null;
    this._chip = null;
    this._last_uid = "";
    this._chipset_name = "";
    this._disconnected = false;
    this._onconnect = null;
    this._ondisconnect = null;
    this._ongetuid = null;
  }
  get last_uid()        { return this._last_uid;          }
  get chipset_name()    { return this._chipset_name;      }
  get disconnected()    { return this._disconnected;      }
  set onconnect(fn)     {        this._onconnect = fn;    }
  get onconnect()       { return this._onconnect;         }
  set ondisconnect(fn)  {        this._ondisconnect = fn; }
  get ondisconnect()    { return this._ondisconnect;      }
  set ongetuid(fn)      {        this._ongetuid = fn;     }
  get ongetuid()        { return this._ongetuid;          }

  async connect() {
    return new Promise( async (resolve, reject) => {

      this._usb = new WebUSBDevice();
      await this._usb.connect();

      this._chip = new Chipset(this._usb);
      await this._chip.connect();

      const [minor, major] = await this._chip.get_firmware_version();
      this._chipset_name = `NFC Port-100 v${major}.${minor}`;

      if (this._onconnect) {
        this._onconnect(this._chipset_name);
      }
      resolve();
    });
  }

  async disconnect() {
    return new Promise( async (resolve, reject) => {
      if (this._chip) {
        await this._chip.disconnect();
        this._chip = null;
      }
      if (this._usb) {
        await this._usb.disconnect();
        this._usb = null;
      }
      if (this._ondisconnect) {
        this._ondisconnect(this._chipset_name);
      }
      this._disconnected = true;
      //console.log("_disconnected");
      resolve();
    });
  }

  async scan(options = { interval: 1000 }) {
    return new Promise( async (resolve, reject) => {
      while (true) {
        if (this._disconnected) {
          this._disconnected = false;
          //console.log("_disconnected!!");
          resolve();
          break;
        }

        try {
          const ok = await this.greeting();
          if (ok) {
            const uid = await this.sense();

            if (this._last_uid !== uid) {
              this._last_uid = uid;
              if (this._ongetuid) {
                this._ongetuid(uid);
              }
            }
          }
        } catch (err) {
        }
        await this._chip.switch_rf("off");
        await sleep(options.interval || 1000);
      }
    });
  }

  async greeting() { // @resolve(Boolean)
    return new Promise( async (resolve, reject) => {
      const brty = "106A";

      try {
        await this._chip.in_set_rf(brty);
        await this._chip.in_set_protocol(s2a(
            ("0018 0101 0201 0300 0400 0500 0600 0708 0800 0900" +
             "0A00 0B00 0C00 0E04 0F00 1000 1100 1200 1306").replace(/\s+/g, "")));
        await this._chip.in_set_protocol([
          ADD_CRC, 0,
          CHECK_CRC, 0,
          CHECK_PARITY, 1,
          INITIAL_GUARD_TIME, 6,
          LAST_BYTE_BIT_COUNT, 7
        ]);

        const { ok, data:sens_res } = await this._chip.in_comm_rf([0x26], 30);
//console.log(ok, hex(sens_res));
        if (!ok || sens_res.length !== 2) {
          if (comp(sens_res, "80000000")) {
            //
          } else {
            console.error(error, ERROR_COMMUNICATION[hex(sens_res)]);
          }
          resolve(false);
          return;
        }

        //console.info(`rcvd SENS_RES ${hex(sens_res)}`);
        if ((sens_res[0] & 0x1F) === 0) {
          console.warn("type 1 tag target found");
          reject(new Error("Unsupported"));
        }

        await this._chip.in_set_protocol([
          ADD_PARITY, 1,
          LAST_BYTE_BIT_COUNT, 8
        ]);
        resolve(true);
      } catch (err) {
        throw err;
      }
    });
  }

  async sense() {
    return new Promise( async (resolve, reject) => {
      let uid = [];

      const commands = [ 0x93, 0x95, 0x97 ];

      try {
        for (let i = 0, iz = commands.length; i < iz; ++i) {
          const sel_cmd = commands[i];
          //console.log("sel_cmd: " + hex([ sel_cmd ]));

          await this._chip.in_set_protocol([
            ADD_CRC, 0,
            CHECK_CRC, 0
          ]);
          const sdd_req = [ sel_cmd ].concat(0x20);

          //console.info(`send SDD_REQ: ${hex(sdd_req)}`);

          const { ok1, data:sdd_res } = await this._chip.in_comm_rf(sdd_req, 30);

          //console.info(`rcvd SDD_RES: ${hex(sdd_res)}`);

          await this._chip.in_set_protocol([
            ADD_CRC, 1,
            CHECK_CRC, 1
          ]);

          const sel_req = [ sel_cmd, 0x70 ].concat(sdd_res);
          //console.info(`send SEL_REQ: ${hex(sel_req)}`);

          const { ok2, data:sel_res } = await this._chip.in_comm_rf(sel_req, 30);
          //console.info(`rcvd SEL_RES: ${hex(sel_res)}`);

          if (sel_res[0] & 0b00000100) {
            uid = uid.concat( sdd_res.slice(1, 4) );
          } else {
            uid = uid.concat( sdd_res.slice(0, 4) );
            break
          }
        }
      //console.info(hex(uid));
        resolve(uid);
      } catch (err) {
        throw err;
      }
    });
  }
}

