import puppeteer from "puppeteer";
import express from "express";
import * as dotenv from "dotenv";
import {
  v4 as uuidv4
} from "uuid";
import {
  allSizes,
  isValidUrl,
  responseType
} from "./other.js";
import stream from "stream";

dotenv.config();

const PORT = process.env.PORT || 5050;

const tempStorage = {};

const app = express();
app.use(express.json());

app.post("/downloadPDF", async (req, res) => {
  try {
    const {
      content,
      type,
      fileName,
      size,
      response,
    } = req.body;

    // content validate here
    if (!content || !content.trim()) return res.status(400).send({
      status: false,
      message: "content (field and value) required"
    });

    // type validate here
    if (!type || !type.trim()) return res.status(400).send({
      status: false,
      message: "type (field and value) required (HTML_TEXT or URL)"
    });

    // size validate here
    if (size && size.trim()) {
      if (!allSizes.includes(size)) return res.status(400).send({
        status: false,
        message: "size (field and value) required and only accept " + allSizes.join(', ')
      });
    }

    // response
    if (response && !responseType.includes(response)) return res.status(400).send({
      status: false,
      message: "response (field and value) required and only accept " + responseType.join(', ')
    });


    // Create a browser instance
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    // Create a new page
    const page = await browser.newPage();

    if (type == "HTML_TEXT") {
      //Get HTML content from HTML file
      await page.setContent(content, {
        waitUntil: "domcontentloaded"
      });
    }

    if (type == "URL") {
      if (!isValidUrl(content))
        return res.status(400).send({
          status: false,
          message: "Invalid URL, Please enter valid one."
        });
      // Open URL in current page
      await page.goto(content, {
        waitUntil: "networkidle0"
      });
    }

    if (["HTML_TEXT", "URL"].includes(type)) {
      // To reflect CSS used for screens instead of print
      await page.emulateMediaType("screen");

      // Downlaod the PDF
      const pdf = await page.pdf({
        margin: {
          top: "50px",
          right: "50px",
          bottom: "50px",
          left: "50px"
        },
        printBackground: true,
        format: size || "A4"
      });
      // Close the browser instance
      await browser.close();

      //return base 64 text if isBase64 is true
      if (response == 'BASE64') {
        return req.status(200).send({
          status: true,
          data: {
            base64: pdf.toString('base64')
          }
        })
      } else if (response == 'URL') {

        // store temp
        const key = uuidv4().toString();
        tempStorage[key] = pdf;

        //url
        const sortUrlDomain = `${req.protocol}://${req.headers.host}/download/`;

        //expire after 2 min
        setTimeout(() => {
          removeData(key)
        }, 120000);

        return req.status(200).send({
          status: true,
          data: {
            url: sortUrlDomain + key
          }
        })
      }

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

app.get("/download/:key", (req, res) => {
  try {
    if (!tempStorage[req.params.key]) return res.status(404).send({
      status: false,
      messahe: 'Invalid url!'
    })
    const temp = tempStorage[req.params.key]
    delete tempStorage[req.params.key];
    res.status(200).download(temp);
  } catch (e) {
    res.status(500).send({
      status: false,
      messahe: e.message
    })
  }
})

app.listen(PORT, (err) => {
  if (err) {
    return console.log("Error:", err.message);
  }
  return console.log("Server connected with port number", PORT);
});



// ---------------------- --------------------------- -------------------
const removeData = (key) => {
  console.log(key, 'deleted!')
  delete tempStorage[key];
}