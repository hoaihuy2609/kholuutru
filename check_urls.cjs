require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFiles() {
  console.log("Checking files in database...");
  
  // Fetch chapter_files
  const { data: chapterFiles, error: err1 } = await supabase.from('chapter_files').select('id, name, url, file_id, telegram_file_id');
  if (err1) console.error("Error fetching chapter_files", err1);
  
  // Fetch lesson_files
  const { data: lessonFiles, error: err2 } = await supabase.from('lesson_files').select('id, name, url, file_id, telegram_file_id');
  if (err2) console.error("Error fetching lesson_files", err2);
  
  // Fetch exams (they have pdfTelegramFileId or pdf_url)
  const { data: exams, error: err3 } = await supabase.from('exams').select('id, title, pdf_telegram_file_id, pdf_url');
  if (err3) console.error("Error fetching exams", err3);

  let badChapterFiles = [];
  let badLessonFiles = [];
  
  if (chapterFiles) {
    chapterFiles.forEach(f => {
      if (!f.url || !f.url.endsWith('.pdf') || f.url.includes('physivault.vercel.app')) {
        badChapterFiles.push(f);
      }
    });
  }

  if (lessonFiles) {
    lessonFiles.forEach(f => {
      if (!f.url || !f.url.endsWith('.pdf') || f.url.includes('physivault.vercel.app')) {
        badLessonFiles.push(f);
      }
    });
  }

  console.log(`\n--- RESULT ---`);
  console.log(`Total chapter files checking: ${chapterFiles?.length || 0}`);
  console.log(`Total lesson files checking: ${lessonFiles?.length || 0}`);
  
  console.log(`\nFound ${badChapterFiles.length} chapter files with weird URL:`);
  badChapterFiles.slice(0, 5).forEach(f => console.log(`- [${f.id}] ${f.name} => URL: ${f.url?.substring(0, 100)}...`));
  if (badChapterFiles.length > 5) console.log(`... and ${badChapterFiles.length - 5} more.`);

  console.log(`\nFound ${badLessonFiles.length} lesson files with weird URL:`);
  badLessonFiles.slice(0, 5).forEach(f => console.log(`- [${f.id}] ${f.name} => URL: ${f.url?.substring(0, 100)}...`));
  if (badLessonFiles.length > 5) console.log(`... and ${badLessonFiles.length - 5} more.`);
  
  // Check if any url is literally the Cloudflare domain without /getFile
  let proxyUrls = 0;
  if(chapterFiles) {
    chapterFiles.forEach(f => {
       if (f.url && f.url.includes('workers.dev')) proxyUrls++;
    });
  }
  console.log(`\nFiles using workers.dev in their url: ${proxyUrls}`);
}

checkFiles().catch(console.error);
