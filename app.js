import puppeteer from "puppeteer";
import express from "express";
import * as dotenv from "dotenv";
import { isValidUrl } from "./other.js";
import stream from "stream";
dotenv.config();

const PORT = process.env.PORT || 5050;

const app = express();
app.use(express.json());

app.post("/downloadPDF", async (req, res) => {
  try {
    const { content, type, fileName } = req.body;
    if (!content || !content.trim())
      return res
        .status(400)
        .send({ status: false, message: "content (field and value) required" });
    if (!content || !content.trim())
      return res.status(400).send({
        status: false,
        message: "type (field and value) required (HTML_TEXT or URL)"
      });

    // Create a browser instance
    const browser = await puppeteer.launch();
    // Create a new page
    const page = await browser.newPage();

    if (type == "HTML_TEXT") {
      //Get HTML content from HTML file
      await page.setContent(content, { waitUntil: "domcontentloaded" });
    }

    if (type == "URL") {
      if (!isValidUrl(content))
        return res.status(400).send({
          status: false,
          message: "Invalid URL, Please enter valid one."
        });
      // Open URL in current page
      await page.goto(content, { waitUntil: "networkidle0" });
    }

    if (["HTML_TEXT", "URL"].includes(type)) {
      // To reflect CSS used for screens instead of print
      await page.emulateMediaType("screen");

      // Downlaod the PDF
      const pdf = await page.pdf({
        margin: { top: "50px", right: "50px", bottom: "50px", left: "50px" },
        printBackground: true,
        format: "A3"
      });
      // Close the browser instance
      await browser.close();

      // streem here
      var readStream = new stream.PassThrough();
      readStream.end(pdf);

      res.set(
        "Content-disposition",
        "attachment; filename=" + (fileName || "Untitled")
      );
      res.set("Content-Type", "application/pdf");
      return readStream.pipe(res);
    }

    return res.status(400).send({
      status: false,
      message: "Invalid type only accept (HTML_TEXT or URL)"
    });
  } catch (e) {
    return res.status(500).send({
      status: false,
      message: e.message
    });
  }
});

app.listen(PORT, (err) => {
  if (err) {
    return console.log("Error:", err.message);
  }
  return console.log("Server connected with port number", PORT);
});
