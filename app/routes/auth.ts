import type {MediaRow, UserRow} from '../types';
import type {RequestHandler as Middleware} from 'express';

import crypto from "crypto";
import express from "express";
import passport from "passport";

import { Strategy as LocalStrategy } from "passport-local";

import db from "../db";

let router = express.Router();

passport.use(new LocalStrategy(function verify(username, password, cb) {
	db.get("SELECT * FROM users WHERE username = ?", [username], function(err: Error, row: UserRow) {
		if (err) {
			return cb(err);
		}
		if (!row) {
			return cb(null, false, {
				message: "Incorrect username or password."
			});
		}

		crypto.pbkdf2(password, row.salt, 310000, 32, "sha256", function(err, hashedPassword) {
			if (err) {
				return cb(err);
			}
			if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
				return cb(null, false, {
					message: "Incorrect username or password."
				});
			}
			return cb(null, row);
		});
	});
}));

passport.serializeUser(function(user, cb) {
	process.nextTick(function() {
		cb(null, {
			// @ts-ignore
			id: user.id,
			// @ts-ignore
			username: user.username
		});
	});
});

passport.deserializeUser(function(user, cb) {
	process.nextTick(function() {
		return cb(null, user);
	});
});

// @ts-ignore
router.get("/login", function(req, res) {
	res.render("login");
});

router.post("/login/password", passport.authenticate("local", {
	successRedirect: "/",
	failureRedirect: "/login"
}));

router.post("/logout", function(req, res, next) {
	// @ts-ignore, logout is already initalized in app.js
	req.logout(function(err) {
		if (err) {
			return next(err);
		}
		res.redirect("/");
	});
});

export default router;