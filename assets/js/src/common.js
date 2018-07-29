export const sleep = async(msec) => {
  return new Promise(resolve => setTimeout(resolve, msec));
};

export const comp = (a, b) => { // @arg Array|UintArray|HexStringByteArray
                                // @ret Boolean
  if (!a || !b) { throw new TypeError(`Invalid arg`); }
  if (typeof a === "string") { a = s2a(a); }
  if (typeof b === "string") { b = s2a(b); }
  if (a.length !== b.length) { return false; }
  for (let i = 0, iz = a.length; i < iz; ++i) {
    if (a[i] !== b[i]) { return false; }
  }
  return true;
};

export const hex = (a) => { // @arg UINT8Array|UINTArray
                            // @ret HexString
  const result = [];
  for (let i = 0, iz = a.length; i < iz; ++i) {
    const v = a[i];
    if (v < 16) {
      result.push(`0${v.toString(16)}`);
    } else {
      result.push(v.toString(16));
    }
  }
  return "0x" + result.join("");
};

export const s2a = (s) => { // @arg HexStringArray
                            // @ret ByteArray
  if (typeof s !== "string" || s.length % 2) { throw new TypeError(`Invalid type: ${s}`); }
  const a = [];
  for (let i = 0, iz = s.length; i < iz; i += 2) {
    a.push( parseInt(`${s[i]}${s[i+1]}`, 16) );
  }
  return a;
};

export const sum = (a) => { // @arg ByteArray
                            // @ret Number
  return a.reduce((sum, curt) => sum + curt, 0);
};

export const range = (a,             // @arg Number
                      b,             // @arg Number
                      step = 1) => { // @arg Number
                                     // @ret NumberArray
                                     // @see Python2::range()
  const r = [];
  for (; a < b; a += step) {
    r.push(a);
  }
  return r;
};

export const xor = (a) => {
  let r = a[0] || 0;
  for (let i = 1, iz = a.length; i < iz; ++i) {
    r = r ^ a[i];
  }
  return r;
};



