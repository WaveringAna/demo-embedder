import type { RequestHandler as Middleware, NextFunction } from "express";

import fs from "fs";
import process from "process";

import { extension, videoExtensions, imageExtensions } from "./lib";
import { insertToDB } from "./db";
import { ffmpegDownscale, ffProbe } from "./ffmpeg";
import { ffprobe } from "fluent-ffmpeg";

export const checkAuth: Middleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401);
  }
  next();
};

/**Checks shareX auth key */
export const checkSharexAuth: Middleware = (req, res, next) => {
  const auth =
    process.env.EBAPI_KEY || process.env.EBPASS || "pleaseSetAPI_KEY";
  let key = null;

  if (req.headers["key"]) {
    key = req.headers["key"];
  } else {
    return res
      .status(400)
      .send(
        "{success: false, message: 'No key provided', fix: 'Provide a key'}",
      );
  }

  if (auth != key) {
    return res
      .status(401)
      .send(
        "{success: false, message: 'Invalid key', fix: 'Provide a valid key'}",
      );
  }

  const shortKey = key.substr(0, 3) + "...";
  console.log(`Authenicated user with key: ${shortKey}`);

  next();
};

/**Creates oembed json file for embed metadata */
export const createEmbedData: Middleware = async (req, res, next) => {
  const files = req.files as Express.Multer.File[];
  for (const file in files) {
    const nameAndExtension = extension(files[file].originalname);
    const ffProbeData = await ffProbe(
      `uploads/${files[file].originalname}`,
      nameAndExtension[0],
      nameAndExtension[1],
    );
    const width = ffProbeData.streams[0].width;
    const height = ffProbeData.streams[0].height;

    const oembed = {
      type: "video",
      version: "1.0",
      provider_name: "embedder",
      provider_url: "https://github.com/WaveringAna/embedder",
      cache_age: 86400,
      html: `<iframe src='${req.protocol}://${req.get("host")}/gifv/${
        nameAndExtension[0]
      }${nameAndExtension[1]}'></iframe>`,
      width: width,
      height: height,
    };

    fs.writeFile(
      `uploads/oembed-${nameAndExtension[0]}${nameAndExtension[1]}.json`,
      JSON.stringify(oembed),
      function (err) {
        if (err) return next(err);
        console.log(
          `oembed file created ${nameAndExtension[0]}${nameAndExtension[1]}.json`,
        );
      },
    );
  }
  next();
};

/**Creates a 720p copy of video for smaller file */
export const convertTo720p: Middleware = (req, res, next) => {
  const files = req.files as Express.Multer.File[];
  console.log("convert to 720p running");
  for (const file in files) {
    const nameAndExtension = extension(files[file].originalname);

    //Skip if not a video
    if (
      !videoExtensions.includes(nameAndExtension[1]) &&
      nameAndExtension[1] !== ".gif"
    ) {
      console.log(`${files[file].originalname} is not a video file`);
      console.log(nameAndExtension[1]);
      continue;
    }

    console.log(`Creating 720p for ${files[file].originalname}`);

    ffmpegDownscale(
      `uploads/${nameAndExtension[0]}${nameAndExtension[1]}`,
      nameAndExtension[0],
      nameAndExtension[1],
    )
      .then(() => {
        //Nothing for now, can fire event flag that it is done to front end when react conversion is done
      })
      .catch((error) => {
        console.log(`Error: ${error}`);
      });
  }

  next();
};

/**Middleware for handling uploaded files. Inserts it into the database */
export const handleUpload: Middleware = (req, res, next) => {
  if (!req.file && !req.files) {
    console.log("No files were uploaded");
    return res.status(400).send("No files were uploaded.");
  }

  const files = req.files ? (req.files as Express.Multer.File[]) : req.file; //Check if a single file was uploaded or multiple
  //const username = req.user ? req.user.username : "sharex"; //if no username was provided, we can presume that it is sharex
  const username = "admin";
  const expireDate: Date = null; //1 minute in days

  if (files instanceof Array) {
    for (const file in files) {
      insertToDB(files[file].filename, expireDate, username);
    }
  } else insertToDB(files.filename, expireDate, username);

  next();
};
