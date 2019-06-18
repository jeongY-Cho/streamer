var http = require("http");
var url = require("url");
var path = require("path");
var zlib = require("zlib");
var httpAttach = require("http-attach");
var fsProvider = require("./fsProvider");

var CONTENT_TYPE = {
  MANIFEST: "application/vnd.apple.mpegurl",
  SEGMENT: "video/MP2T",
  HTML: "text/html"
};

function HLSServer(server, opts) {
  var self = this;
  if (!(self instanceof HLSServer)) return new HLSServer(server, opts);

  if (server) self.attach(server, opts);
}

HLSServer.prototype.attach = function(server, opts) {
  var self = this;

  opts = opts || {};
  self.path = opts.path || self.path || "/";
  self.dir = opts.dir || self.dir || "";
  self.debugPlayer = opts.debugPlayer == null ? true : opts.debugPlayer;

  self.provider = opts.provider || fsProvider;

  if (isNaN(server)) {
    httpAttach(server, self._middleware.bind(self));
  } else {
    // Port numbers
    var port = server;
    server = http.createServer();
    httpAttach(server, self._middleware.bind(self));
    server.listen(port);
  }
};

HLSServer.prototype._middleware = function(req, res, next) {
  var self = this;

  var uri = url.parse(req.url).pathname;
  console.log(uri);

  var relativePath = path.relative(self.path, uri);
  console.log(relativePath);

  var filePath = path.join(self.dir, relativePath);
  console.log(filePath);

  var extension = path.extname(filePath);

  req.filePath = filePath;

  // Gzip support
  var ae = req.headers["accept-encoding"] || "";
  req.acceptsCompression = ae.match(/\bgzip\b/);

  self.provider.exists(req, function(err, exists) {
    if (err) {
      res.statusCode = 500;
      res.end();
    } else if (!exists) {
      res.statusCode = 404;
      res.end();
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
      switch (extension) {
        case ".m3u8":
          self._writeManifest(req, res, next);
          break;
        case ".ts":
          self._writeSegment(req, res, next);
          break;
        default:
          next();
          break;
      }
    }
  });
};

// HLSServer.prototype._writeDebugPlayer = function(res, next) {
//   res.setHeader("Content-Type", CONTENT_TYPE.HTML);
//   res.statusCode = 200;
//   // TODO: Use HLS.js
//   res.write(debugPlayer.html);
//   res.end();
//   next();
// };

HLSServer.prototype._writeManifest = function(req, res, next) {
  var self = this;

  self.provider.getManifestStream(req, function(err, stream) {
    if (err) {
      res.statusCode = 500;
      res.end();
      return next();
    }

    res.setHeader("Content-Type", CONTENT_TYPE.MANIFEST);

    res.statusCode = 200;

    if (req.acceptsCompression) {
      res.setHeader("content-encoding", "gzip");
      res.statusCode = 200;
      var gzip = zlib.createGzip();
      stream.pipe(gzip).pipe(res);
    } else {
      stream.pipe(
        res,
        "utf-8"
      );
    }
  });
};

HLSServer.prototype._writeSegment = function(req, res, next) {
  var self = this;

  self.provider.getSegmentStream(req, function(err, stream) {
    if (err) {
      res.statusCode = 500;
      res.end();
      return;
    }
    res.setHeader("Content-Type", CONTENT_TYPE.SEGMENT);
    res.statusCode = 200;
    stream.pipe(res);
  });
};

class MyServer {
  constructor(opts) {
    this.path = opts.path || "/streams";
    this.dir = opts.dir || "public/videos";
    this.provider = fsProvider;

    this.middleware = this.middleware.bind(this);
  }

  middleware(req, res, next) {
    var uri = req.path;

    var relativePath = path.relative(this.path, uri);
    var filePath = path.join(this.dir, relativePath);
    var extension = path.extname(filePath);

    req.filePath = filePath;

    // Gzip support
    var ae = req.headers["accept-encoding"] || "";
    req.acceptsCompression = ae.match(/\bgzip\b/);

    this.provider.exists(req, (err, exists) => {
      if (err) {
        res.sendStatus(500);
      } else if (!exists) {
        next();
      } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
        switch (extension) {
          case ".m3u8":
            this._writeManifest(req, res, next);
            break;
          case ".ts":
            this._writeSegment(req, res, next);
            break;
          default:
            next();
            break;
        }
      }
    });
  }

  _writeManifest(req, res, next) {
    this.provider.getManifestStream(req, function(err, stream) {
      if (err) {
        res.sendStatus(500);
        return next();
      }

      res.setHeader("Content-Type", CONTENT_TYPE.MANIFEST);

      res.status(200);

      if (req.acceptsCompression) {
        res.setHeader("content-encoding", "gzip");
        res.status(200);
        var gzip = zlib.createGzip();
        stream.pipe(gzip).pipe(res);
      } else {
        stream.pipe(
          res,
          "utf-8"
        );
      }
    });
  }

  _writeSegment(req, res, next) {
    this.provider.getSegmentStream(req, function(err, stream) {
      if (err) {
        res.sendStatus(500);
        return;
      }
      res.setHeader("Content-Type", CONTENT_TYPE.SEGMENT);
      res.status(200);
      stream.pipe(res);
    });
  }
}

module.exports = MyServer;
