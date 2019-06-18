class SyncedPlayer extends Hls {
  constructor(delay) {
    super();
    this.delay = delay || 25;
  }
  isInit = false;

  async init() {
    if (!this.isInit) {
      this.ping = await this.getAvgPing();
      this.serverOffset = await this.getServerOffSet();
      this.isInit = true;
    } else {
      throw new Error("Already Initialized");
    }
  }

  async resync() {
    this.isInit = false;
    await this.init();
  }

  async getPing() {
    let t0 = Date.now();
    let response = await fetch("/time");
    let t1 = Date.now();
    console.log(t1 - t0);

    return t1 - t0;
  }

  async getAvgPing() {
    let pings1 = [];
    let pings2 = [];

    for (let _ = 0; _ < 2; _++) {
      pings1.push(await this.getPing());
    }
    for (let _ = 0; _ < 2; _++) {
      pings2.push(await this.getPing());
    }

    if (SyncedPlayer.twoSampleTTest(pings1, pings2)) {
      return (
        pings1.concat(pings2).reduce((prev, curr) => prev + curr) /
        (pings1.length + pings2.length)
      );
    } else {
      return await this.getAvgPing();
    }
  }

  async getServerOffSet() {
    let response = await fetch("/time");
    let serverTime = await response.json();
    return Date.now() - serverTime - ((this.ping / 2) << 0);
  }

  get serverTime() {
    return Date.now() - this.serverOffset;
  }

  get epsilon() {
    return 1000 - (this.serverTime % 1000);
  }

  static isNum(args) {
    args = args.toString();
    if (args.length == 0) return false;
    for (var i = 0; i < args.length; i++) {
      if (
        (args.substring(i, i + 1) < "0" || args.substring(i, i + 1) > "9") &&
        args.substring(i, i + 1) != "." &&
        args.substring(i, i + 1) != "-"
      ) {
        return false;
      }
    }
    return true;
  }

  static variance(arr) {
    var len = 0;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] == "") {
      } else if (!SyncedPlayer.isNum(arr[i])) {
        alert(arr[i] + " is not number, Variance Calculation failed!");
        return 0;
      } else {
        len = len + 1;
        sum = sum + parseFloat(arr[i]);
      }
    }
    var v = 0;
    if (len > 1) {
      var mean = sum / len;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] == "") {
        } else {
          v = v + (arr[i] - mean) * (arr[i] - mean);
        }
      }
      return v / (len - 1);
    } else {
      return 0;
    }
  }
  static twoSampleTTest(arr1, arr2) {
    let mean1 = arr1.reduce((x, y) => x + y);
    let var1 = SyncedPlayer.variance(arr1);

    let mean2 = arr2.reduce((x, y) => x + y);
    let var2 = SyncedPlayer.variance(arr2);

    let joinedSE = var1 / mean1 + var2 / mean2;
    let T = (mean1 - mean2) / Math.sqrt(joinedSE);
    let dof =
      Math.pow(joinedSE, 2) /
      (Math.pow(var1 / arr1.length, 2) / (arr1.length - 1) +
        Math.pow(var2 / arr2.length, 2) / (arr2.length - 1));

    let cdf = jStat.studentt.cdf(T, dof);
    console.log(cdf);

    if (cdf < 0.525 && cdf > 0 / 475) {
      return true;
    } else {
      return false;
    }
  }
}
