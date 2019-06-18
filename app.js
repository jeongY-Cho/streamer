const express = require("express");
var HLSServer = require("./hls-server");
const ffmpeg = require("fluent-ffmpeg");
const join = require("path").join;
const qrcode = require("qrcode");

ffmpeg.setFfmpegPath("ffmpeg/bin/ffmpeg");

const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, "/public")));

// app.use("/streams", (req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   next();
// });

let hlsServer = new HLSServer({
  path: "/streams",
  dir: "public/videos"
});

app.use(hlsServer.middleware);
const path = "/streams";
const dir = "public/videos";
const port = 8000;

const videoInput = "http://localhost:" + port + path + "/output.m3u8";
// const videoInput =
//   "C:/Users/Jeong/Downloads/y2mate.com_happy_together_the_rehabilitation_project_eng20160630_qCQvM6QWSf4_720p.mp4";
let thing = app.listen(port, async () => {
  console.log("listening on port: " + port);
  let ip = await getMyIPAddress();

  let link = `http://${ip}:${port}/audio`;
  let qrpng = join(__dirname, "/public/img/qrcode.png");
  qrcode.toFile(qrpng, link, () => {
    ffmpeg()
      .input(videoInput)
      .native()
      .output(dir + "/audio.m3u8")
      .noVideo()
      .addOption([
        "-c copy",
        "-hls_time 5",
        "-vn",
        "-hls_list_size 6",
        "-hls_time 3",
        "-start_number 1",
        "-hls_flags program_date_time+omit_endlist",
        "-hls_wrap 10",
        "-hls_allow_cache 0",
        "-f hls"
      ])
      .output(dir + "/video.m3u8")
      .addOption([
        "-c copy",
        "-x264-params g=2",
        "-hls_flags program_date_time+split_by_time+omit_endlist",
        "-hls_list_size 6",
        "-hls_time 5",
        "-hls_wrap 10",
        "-f hls"
      ])
      .run();
  });
});

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "/public/html/devPlayer.html"));
});

app.get("/time", (req, res) => {
  if (req.headers.origin) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  }

  res.send(JSON.stringify(Date.now()));
});

app.get("/video", (req, res) => {
  res.sendFile(join(__dirname, "/public/html/video.html"));
});
app.get("/audio", (req, res) => {
  res.sendFile(join(__dirname, "/public/html/audio.html"));
});

const { lookup } = require("dns").promises;
const { hostname } = require("os");

async function getMyIPAddress(options) {
  return (await lookup(hostname(), options)).address;
}
