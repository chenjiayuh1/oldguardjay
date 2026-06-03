const mammoth = require('mammoth');
const fs = require('fs');

mammoth.convertToText({path: "all-posts.docx"})
  .then(result => {
    let text = result.value;
    fs.writeFileSync("all-posts.txt", text);
    console.log("✅ Successfully extracted text!");
    console.log("\nFirst 300 characters:");
    console.log(text.substring(0, 300));
    console.log("\nLength:", text.length, "characters");
  })
  .catch(err => {
    console.error("Failed:", err.message);
  });
