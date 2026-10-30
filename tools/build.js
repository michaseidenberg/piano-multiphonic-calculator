// Baut index.html + js/*.js zu einer einzigen HTML-Datei zusammen.
//   node tools/build.js                 → dist/piano-multiphonics.html
//   node tools/build.js --fragment OUT  → ohne <html>/<head>/<body> (für eine gehostete Seite)
//   node tools/build.js --page OUT      → wie --fragment, aber die Skripte bleiben als
//                                         <script src="js/…"> (iPad-Seite mit js/*.js als
//                                         eigenen Dateien; nur die kleine Seite muss vor dem
//                                         Neuveröffentlichen gelesen werden)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const args = process.argv.slice(2);
const page = args[0] === "--page";

if (!page) html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), "utf8");
  return "<script>\n" + code.replace(/<\/script/gi, "<\\/script") + "\n</script>";
});

let out = path.join(root, "dist", "piano-multiphonics.html");
if (args[0] === "--fragment" || page) {
  out = args[1];
  const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  html = title + "\n" + style + "\n" + body;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + " KB");
