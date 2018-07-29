import { RCS380 } from "/assets/js/src/rcs380.js";
import { hex } from "/assets/js/src/common.js";

const btn_connect = document.querySelector(".connect");
const btn_disconnect = document.querySelector(".disconnect");

const rcs380 = new RCS380();
rcs380.onconnect = (chipset_name) => console.log(`connected: ${chipset_name}`);
rcs380.ondisconnect = (chipset_name) => console.log(`disconnected: ${chipset_name}`);
rcs380.ongetuid = (uid) => console.log(`uid: ${hex(uid)}`);

btn_connect.onclick = async () => {
  try {
    await rcs380.connect();
    await rcs380.scan({ interval: 1000 });
  } catch (err) {
    console.error(err.message);
  }
};
btn_disconnect.onclick = async () => {
  try {
    await rcs380.disconnect();
  } catch (err) {
    console.error(err.message);
  }
};

