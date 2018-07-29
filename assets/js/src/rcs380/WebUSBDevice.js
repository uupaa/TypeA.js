import { s2a, sleep } from "../common.js";

export class WebUSBDevice {
  constructor() {
    this.usb = null;
  }

  async connect() {
    try {
      this.usb = await navigator.usb.requestDevice({ filters: [{
        vendorId:     0x054c, // 054c  Sony Corp.
        protocolCode: 0x01,
      }]});
      // http://www.linux-usb.org/usb.ids
      // 06c3  RC-S380
      console.log(this.usb.productName);      // RC-S380/P
      console.log(this.usb.manufacturerName); // SONY
      await this.usb.open();
      await this.usb.selectConfiguration(1);
      await this.usb.claimInterface(0);
    } catch (err) {
      console.log(err.message);
      this.usb = null;
      //alert(err.message);
      //throw err;
    }
  }
  async reset() {
    if (this.usb) {
      return this.usb.reset();
    }
  }

  async disconnect() {
    return new Promise( async (resolve, reject) => {
      if (this.usb && this.usb.opened) {
        await this.usb.close();
        this.usb = null;
      }
      resolve();
    });
  }

  async send(data) { // @arg UINT8NumberArray|String - [ uint8, ... ] or "FF0102"
    if (!this.usb) { return; }

    const u8a = new Uint8Array(typeof data === "string" ? s2a(data) : data);
    //console.log(`>>> send >>> ${hex(u8a)} (${u8a.length} bytes)`);
    await this.usb.transferOut(2, u8a);
    await sleep(10);
  }

  async recv() { // @arg UINT8NumberArray - [ uint8, ... ]
    if (!this.usb) { return []; }
    const data = await this.usb.transferIn(1, 300);
    await sleep(10);

    const a = [];
    for (let i = data.data.byteOffset, iz = data.data.byteLength; i < iz; i++) {
      a.push(data.data.getUint8(i));
    }
    //console.log(`<<< recv <<< ${hex(a)} (${a.length} bytes)`);
    return a;
  }
}


