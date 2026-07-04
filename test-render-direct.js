const { renderCvPdf } = require('./.next/server/app/api/cvs/[id]/route.js');
async function test() {
  try {
    console.log("Starting render test...");
    await renderCvPdf({
      templateId: "modern",
      accentColor: "#2563eb",
      fontId: "inter",
      fullName: "Test User",
      email: "test@example.com",
      phone: "123456",
      content: {
        summary: "Test summary that is long enough to pass validation in schemas. Test summary.",
        experience: [{ company: "A", title: "B", startDate: "Jan 2020", endDate: "Present", bullets: ["Test"] }],
        skills: ["Skill 1"]
      }
    });
    console.log("Render test succeeded!");
  } catch (e) {
    console.error("Render test failed:", e);
  }
}
test();
