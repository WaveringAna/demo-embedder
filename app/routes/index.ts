import type {
  RequestHandler as Middleware,
  Request,
  Response,
  NextFunction,
} from "express";

import multer from "multer";
import express from "express";
import imageProbe from "probe-image-size";

import { ffProbe } from "../lib/ffmpeg";

import fs from "fs";

import { extension /**, videoExtensions**/ } from "../lib/lib";
import { db, MediaRow /**, getPath, deleteId **/ } from "../lib/db";
import { fileStorage } from "../lib/multer";
import {
  //checkAuth,
  //checkSharexAuth,
  convertTo720p,
  createEmbedData,
  handleUpload,
} from "../lib/middleware";

const upload = multer({ storage: fileStorage /**, fileFilter: fileFilter**/ }); //maybe make this a env variable?
/**Middleware to grab media from media database */
const fetchMedia: Middleware = (req, res, next) => {
  //const admin: boolean = req.user.username == "admin" ? true : false;
  const admin = true;
  /**Check if the user is an admin, if so, show all posts from all users */
  const query: string =
    admin == true
      ? "SELECT * FROM media"
      : `SELECT * FROM media WHERE username = '${req.user.username}'`;

  db.all(query, (err: Error, rows: []) => {
    if (err) return next(err);
    const files = rows.map((row: MediaRow) => {
      return {
        id: row.id,
        path: row.path,
        expire: row.expire,
        username: row.username,
        url: "/" + row.id,
      };
    });
    res.locals.files = files.reverse(); //reverse so newest files appear first
    res.locals.Count = files.length;
    next();
  });
};

const router = express.Router();

router.get(
  "/",
  /*(req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.render("home");
    next();
  },*/
  fetchMedia,
  (req: Request, res: Response) => {
    res.locals.filter = null;
    res.render("index", { user: req.user });
  },
);

/*router.get("/media-list", fetchMedia, (req: Request, res: Response) => {
  res.render("partials/_fileList"); // Render only the file list partial
});*/

router.get(
  "/gifv/:file",
  async (req: Request, res: Response, next: NextFunction) => {
    const url = `${req.protocol}://${req.get("host")}/uploads/${
      req.params.file
    }`;
    let width;
    let height;

    const nameAndExtension = extension(`uploads/${req.params.file}`);
    if (
      nameAndExtension[1] == ".mp4" ||
      nameAndExtension[1] == ".mov" ||
      nameAndExtension[1] == ".webm" ||
      nameAndExtension[1] == ".gif"
    ) {
      const imageData = ffProbe(
        `uploads/${req.params.file}`,
        nameAndExtension[0],
        nameAndExtension[1],
      );

      width = (await imageData).streams[0].width;
      height = (await imageData).streams[0].height;

      return res.render("gifv", {
        url: url,
        host: `${req.protocol}://${req.get("host")}`,
        width: width,
        height: height,
      });
    } else {
      const imageData = await imageProbe(
        fs.createReadStream(`uploads/${req.params.file}`),
      );
      return res.render("gifv", {
        url: url,
        host: `${req.protocol}://${req.get("host")}`,
        width: imageData.width,
        height: imageData.height,
      });
    }
  },
);

router.post(
  "/",
  [
    /*checkAuth,*/
    upload.array("fileupload"),
    convertTo720p,
    createEmbedData,
    handleUpload,
  ],
  (req: Request, res: Response) => {
    res.redirect("/");
  },
);

/*router.post(
  "/sharex",
  [checkSharexAuth, upload.single("fileupload"), createEmbedData, handleUpload],
  (req: Request, res: Response) => {
    return res.send(
      `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
    );
  },
);*/

router.post(
  "/:id(\\d+)/delete",
  //[checkAuth],
  async (req: Request, res: Response) => {
    /*const path: any = await getPath(req.params.id);

    const nameAndExtension = extension(path.path);

    const filesToDelete = [path.path, "oembed-" + path.path + ".json"];

    if (
      videoExtensions.includes(nameAndExtension[1]) ||
      nameAndExtension[1] == ".gif"
    ) {
      filesToDelete.push("720p-" + path.path);
    }

    filesToDelete.forEach((path) => {
      fs.unlink(path, async (err) => {
        console.log(`Deleting ${path}`);
        if (err && err.errno == -4058) {
          await deleteId("media", req.params.id);
        }
        await deleteId("media", req.params.id);
      });
    });*/

    return res.redirect("/");
  },
);

export default router;
