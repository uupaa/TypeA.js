import { comp, hex, sum } from "../common.js";

export class Frame {
  constructor(data) {
    this._data = null;
    this._type = null;
    this._frame = null;

    if ( comp(data.slice(0, 3), [0x00, 0x00, 0xFF]) ) {
      let frame = data;

      if ( comp(frame, [0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00]) ) {
        this._type = "ack";
      } else if ( comp(frame, [0x00, 0x00, 0xFF, 0xFF, 0xFF]) ) {
        this._type = "err";
      } else if ( comp(frame.slice(3, 5), [0xFF, 0xFF]) ) {
        this._type = "data";
      }
      if (this._type === "data") {
        let length = (frame[5] | frame[6] << 8);  // frame = 0300 -> length = 3
        this._data = frame.slice(8, 8 + length);
      }
    } else {
      let a = [ 0x00, 0x00, 0xFF, 0xFF, 0xFF ];
      a.push( data.length & 0xFF, ((data.length >> 8) & 0xFF) ); // data.length = 3 -> 0x0300
      a.push( ((256 - a[5] + a[6]) % 256) & 0xFF );
      a = a.concat(data);
      a.push( (256 - sum(a.slice(8)) % 256) & 0xFF, 0 );
      this._frame = a;
    }
  }
  get type() { return this._type; }
  get data() { return this._data; }
  get frame() { return this._frame; } // UINT8NumberArray - [ unit8, ... ]
}

