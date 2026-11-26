/*
 * ─────────────────────────────────────────────────────────────
 *  SITE CONTENT — edit this file to update the website.
 *  Plain strings only (the page escapes HTML for you).
 * ─────────────────────────────────────────────────────────────
 */

window.SITE = {
  name: "Lauren Bourque",
  tagline: "Engineer & Entrepreneur",

  // Square photo in the top-left corner. Put the file in /assets and set the path,
  // e.g. "assets/lauren.jpg". Leave empty to show the pixel portrait instead.
  photo: "assets/lauren.jpg",

  email: "lolobq47@gmail.com",
  emailSubject: "Hi Lauren, saw your portfolio",

  resumePdf: "assets/resume.pdf",
  linkedin: "https://www.linkedin.com/in/lauren-bourque/",
  github: "https://github.com/lolobq",
  calendar: "https://calendar.app.google/X2TgfwioqwVjECZS6", // Google Calendar booking page
  youtube: "https://www.youtube.com/@lauren_bourque",

  // Colors for the pixel sculptor (and the statue's shape) so they can match you.
  sprite: {
    hair: "#6b4228",
    hairShade: "#45291a",
    hairLight: "#a8774a",
    skin: "#f3c9ad",
    skinShade: "#dfa186",
    top: "#3f72c2",
    topShade: "#2c5596",
    jeans: "#5d80ad",
    jeansShade: "#45648e",
    shoes: "#4a2f25",
    lips: "#c46a6a",
  },
};

/*
 * STORY CARDS — the homepage scroll story, shown in order as the visitor scrolls.
 * Prologue, then six identity cards (builder and personal alternate), then the closing card.
 *
 * Fields (all optional except title):
 *   kicker   small label above the title
 *   title    headline
 *   body     one or more paragraphs (array of strings)
 *   images   [{ src, alt }]
 *   links    [{ label, href }]
 *   cta      { label, href } — only on the closing card
 */
window.CARDS = [
  {
    kicker: "Prologue",
    title: "Everyone shows you the statue. Here's how I carved mine.",
  },
  {
    kicker: "Inventor",
    title: "My younger self always wanted to invent.",
    body: [
      "So I did.",
      "I'm an inventor on a USPTO patent filing, and I led a bank-wide innovation capstone that turned analysts' ideas into 5 more patent applications.",
    ],
  },
  {
    kicker: "Athlete",
    title: "My younger self always wanted to step on a bodybuilding stage.",
    body: [
      "So after tearing my labrum and getting major hip surgery in January, I committed a year to building muscle.",
      "I step on stage December 5.",
    ],
    images: [
      { src: "assets/img/surgery.webp", alt: "Lauren on crutches in a hip brace, days after her hip surgery" },
      { src: "assets/img/transformation.webp", alt: "Side-by-side before and after photos of Lauren flexing, showing the muscle she built" },
    ],
  },
  {
    kicker: "Engineer",
    title: "My younger self always wanted to fix the thing everyone else works around.",
    body: [
      "So I did.",
      "I helped modernize a 20-year-old system that 7M clients rely on, saving $4M a year.",
    ],
  },
  {
    kicker: "Competitor",
    title: "My younger self always wanted to compete with the best.",
    body: [
      "So I did.",
      "Collegiate Women's All-American disc golfer, and now I play professional tournaments for money.",
    ],
    images: [
      { src: "assets/img/discgolf-throw.webp", alt: "Lauren lining up a throw on a wooded disc golf course" },
      { src: "assets/img/discgolf-podium.webp", alt: "Lauren with the women's field, holding trophies at a disc golf tournament" },
    ],
  },
  {
    kicker: "Founder",
    title: "My younger self always wanted to build my own company.",
    body: [
      "So I am.",
      "I'm co-founding a stealth AI startup that helps people practice the conversations they dread.",
    ],
  },
  {
    kicker: "Mentor",
    title: "My younger self always wanted to help people grow.",
    body: [
      "So I do.",
      "I speak to rooms of 300+, mentor interns and analysts, and built a 20k+ community (6M+ views).",
    ],
    images: [
      { src: "assets/img/speaking-disney.webp", alt: "Lauren on stage on a panel at the Walt Disney World intern induction, with the audience in the foreground" },
    ],
  },
  {
    kicker: "Epilogue",
    title: "The common thread?",
    body: [
      "I get a thrill from doing what people think is impossible, with a smile on my face and a chip on my shoulder.",
      "Michelangelo said the statue is discovered. I think it's created, with tools you already carry. My favorite part is creating the statue from the slab of marble.",
      "I'd love to help you create yours. Let's build together.",
    ],
    cta: { label: "Let's Grab Coffee", href: "https://calendar.app.google/X2TgfwioqwVjECZS6" },
  },
];

/*
 * RESUME — the HTML document view of the Resume tab. Source: assets/resume.pdf.
 *   experience  [{ org, role, location, dates, bullets: [..] }]
 *   education   [{ school, degree, dates, note }]
 *   skills      [{ label, items: [..] }]
 *   honors      [..strings]
 *   publications [{ citation, href }]
 */
window.RESUME = {
  title: "Resume",
  lede: "What I've built, where, and the numbers behind it.",
  summary:
    "Software engineer who works with business stakeholders to turn ambiguous problems into shipped systems in regulated, high-stakes environments. Helped modernize legacy reporting for 7M client accounts at Wells Fargo ($4M/yr savings) and led a bank-wide innovation program that sourced problems from senior executives and produced 5 patent applications. Co-founder building a real-time multimodal AI coaching platform. Speaker and creator (20k+ audience) who explains technical systems to any audience.",
  experience: [
    {
      org: "Wells Fargo",
      role: "Software Engineer",
      location: "Charlotte, NC",
      dates: "Feb 2025 – Present",
      bullets: [
        "Analyzed a 500-job monolith application and rewrote 20 Perl and PL/SQL daily trust account performance reporting batch jobs for financial advisors, saving $4M per year; led production releases affecting 7M clients.",
        "Remediated security vulnerabilities on 10+ Java Spring Boot REST API microservices for net worth calculation software using Checkmarx, Octane, Splunk, OCP.",
        "Used Devin to help modernize a 20+ year-old Perl & Oracle reporting application, migrating 20+ batch jobs into one Java Spring Batch framework.",
        "Created Python scripts that auto-create 1000s of unit tests and run automated data validation.",
        "Invented and led a FinTech hackathon for 150 analysts and an AI initiative for 60+ employees, resulting in 5 patent applications; co-authored a USPTO patent filing.",
        "Mentor interns and analysts 1:1; speak on innovation panels and podcasts to audiences of 300+, sharing career advice.",
      ],
    },
    {
      org: "Stealth AI Startup",
      role: "Co-Founder",
      location: "Charlotte, NC",
      dates: "Apr 2026 – Present",
      bullets: [
        "Co-founding an AI platform that gives people reps at difficult conversations, with repeated practice, personalized feedback, and measurable growth over time.",
        "Architecting real-time multimodal audio and video pipelines using LiveKit Agents, faster-whisper, DeepFace, and Google Gemini Live.",
        "Engineering the Python/FastAPI backend with Celery and Redis task queues for facial and acoustic feature extraction (OpenCV, DeepFace, librosa).",
        "Developing the Flutter/Dart mobile app on Cloudflare R2 and PostgreSQL/Supabase, containerized with Docker and tested with pytest and Flutter Test ahead of a ~100-person beta.",
      ],
    },
    {
      org: "Lauren Bourque Co.",
      role: "Founder, Coach, Content Creator",
      location: "Charlotte, NC",
      dates: "Aug 2026 – Present",
      bullets: [
        "Create short-form video and written content on leadership, wellness, and mindset, owning the full cycle from idea to publish: 6M+ views and a 20,000+ community.",
      ],
    },
    {
      org: "UNC Charlotte – TeCSAR Lab",
      role: "App Development & Data Analysis Research Assistant",
      location: "Charlotte, NC",
      dates: "Oct 2021 – May 2024",
      bullets: [
        "Part of $2M NSF-funded research: designed the UI/UX in Figma and built the Flutter prototype for a first-of-its-kind mobile app delivering real-time, privacy-preserving, AI-driven video analytics to improve worker safety; contributed to 2 publications.",
        "Built the cloud backend (Firebase, AWS AppSync, Amplify, DynamoDB, SNS) and used Python and SQL to detect anomalies in real-time data, testing end-to-end on a job site in Uptown Charlotte.",
      ],
    },
    {
      org: "Wells Fargo",
      role: "Software Engineering Intern",
      location: "Charlotte, NC",
      dates: "Jun 2023 – Aug 2023, Jun 2024 – Aug 2024",
      bullets: [
        "Part of the first intern team to ship a project to production, in ~8 weeks: an admin tool (Java, Spring Boot, .NET) that reassigns 1000s of financial plans to new advisors.",
        "Maintained money movement software (C#, ASP.NET, SQL) handling billions of dollars in daily transactions.",
      ],
    },
    {
      org: "Covetrus",
      role: "Data Engineering Intern",
      location: "Portland, ME",
      dates: "Jun 2022 – Aug 2022",
      bullets: [
        "Built a production program (Python, SQL, Snowflake, MongoDB, Kafka) that cleansed 1.9M+ addresses, giving the company a reliable customer list for analytics and marketing.",
      ],
    },
    {
      org: "Progress Engineering, LLC",
      role: "Controls, Software Engineering, and Project Management Intern",
      location: "Manchester, ME",
      dates: "Sep 2020 – Jul 2021",
      bullets: [
        "Built sawmill optimization software in C#, adding $100k+ profit for sawmills, and designed HMI/SCADA systems and PLC programs for mill automation.",
        "Served as project manager on $50k automation projects at a brewery and a truss factory.",
      ],
    },
  ],
  education: [
    {
      school: "The University of Texas at Austin",
      degree: "M.S., Artificial Intelligence",
      dates: "Enrolled Jan 2026",
      note: "On leave",
    },
    {
      school: "University of North Carolina at Charlotte",
      degree: "B.S., Computer Engineering, Concentration in Machine Learning",
      dates: "Dec 2024",
      note: "Magna Cum Laude",
    },
  ],
  skills: [
    { label: "AI, Speech & Vision", items: ["LiveKit / LiveKit Agents", "Hume AI (EVI / Prosody)", "OpenAI Whisper", "Google Gemini / Gemini Live", "DeepFace", "OpenCV", "librosa", "PyTorch", "scikit-learn", "Model Context Protocol (MCP)"] },
    { label: "AI Coding Tools", items: ["Claude Code", "Devin", "Codex", "GitHub Copilot"] },
    { label: "Languages", items: ["Python", "Java", "Dart", "C#", "C++", "SQL", "PL/SQL", "Perl", "MATLAB", "NumPy", "pandas"] },
    { label: "Backend & Distributed Systems", items: ["REST APIs", "FastAPI", "Uvicorn", "Celery / Celery Beat", "Redis", "Spring Boot", "Spring Batch", "ASP.NET", "boto3", "Postman"] },
    { label: "Testing & QA", items: ["Unit, Integration, Regression, and Smoke Testing", "pytest", "Flutter Test", "JUnit", "Splunk", "Octane"] },
    { label: "Mobile, Cloud & Databases", items: ["Flutter", "PostgreSQL / Supabase", "Cloudflare R2", "AWS (DynamoDB, AppSync, Amplify, SNS)", "Firebase", "Snowflake", "MongoDB", "Oracle", "Liquibase", "Apache Kafka"] },
    { label: "DevOps, Enterprise & Security", items: ["Linux", "Docker / Docker Compose", "GitHub Actions", "AutoSys", "SonarQube", "Black Duck", "Checkmarx", "Harness", "Red Hat OpenShift Container Platform (OCP)"] },
    { label: "Release & Collaboration", items: ["Agile / Scrum", "Jira", "Confluence", "ServiceNow (Change Management)"] },
  ],
  honors: ["Women's All-American Disc Golfer (collegiate)"],
  publications: [
    {
      citation: "Yao, S., Bourque, L., et al., “From Lab to Field: Real-World Evaluation of an AI-Driven Smart Video Solution to Enhance Community Safety,” Internet of Things, 2025.",
      href: "https://doi.org/10.1016/j.iot.2025.101716",
    },
    {
      citation: "Ardabili, B., Bourque, L., et al., “Enhancing Situational Awareness in Surveillance,” arXiv:2312.05629, 2023.",
      href: "https://arxiv.org/abs/2312.05629",
    },
  ],
};

/*
 * ABOUT page. body is an array of paragraphs. Professional first, personality second.
 */
window.ABOUT = {
  title: "About me",
  body: [
    "I'm a software engineer and startup co-founder in Charlotte, NC. By day I build production financial systems at Wells Fargo; the rest of the time I'm building an AI platform for anyone to master communication skills.",
    "At Wells Fargo, I helped modernize a 20-year-old reporting system that 7M clients rely on, saving $4M a year. I also led a bank-wide innovation capstone: I pitched senior executives across lines of business for real problems, then ran it for 150+ analysts across 7 U.S. sites. It produced 31 solutions and 5 patent applications. I'm an inventor on a USPTO patent filing, too.",
    "Before that, I spent 2021 to 2024 in UNC Charlotte's TeCSAR Lab on $2M NSF-funded research. I designed and built a first-of-its-kind mobile app for real-time, privacy-preserving AI video analytics for worker safety, tested it on a job site in Uptown Charlotte, and contributed to 2 publications.",
    "The work I like best: walk into a messy, high-stakes environment, sit with the people who have the problem, and build the fix fast. Then explain it to anyone, from an executive to a room of 300.",
    "Outside of work, I'm a Collegiate Women's All-American disc golfer, and now I play professional tournaments for money. In January, I tore my labrum and had major hip surgery. Then I committed a year to building muscle. I step on stage for my first bodybuilding contest December 5.",
    "I also run Lauren Bourque Co., coaching and content on leadership, wellness, and mindset (6M+ views, a 20k+ community). And I'm enrolled in UT Austin's M.S. in Artificial Intelligence, currently on leave.",
    "You don't just find yourself. I've never been a fan of that phrase. I believe you create yourself, and the tools to do it already exist within you. You just have to apply them to reveal the gems that are already there. Self-discovery comes down to self-creation more than anything.",
    "That's how I build software, a body, and a career: with a smile on my face and a chip on my shoulder.",
  ],
};

/*
 * PROJECTS page.
 *   caseStudies  [{ id, title, tag, summary, sections: [{ heading, body: [..] }], links: [{ label, href }] }]
 *                sections follow the FDE format: Problem / Constraints / What I built / Result / What I'd do next
 *   workbench    [{ title, status, description, media }] — media stays null until a demo exists
 */
window.PROJECTS = {
  title: "Projects",
  lede: "Two finished projects, written up the way I'd walk a customer through them. Plus three I'm building right now.",
  caseStudies: [
    {
      id: "smartcity",
      title: "SmartCity worker-safety app",
      tag: "NSF-funded research · UNC Charlotte TeCSAR Lab · 2021–2024",
      summary: "A first-of-its-kind mobile app that turns live video into real-time, privacy-preserving safety insights for workers. Designed, built, field-tested, and published.",
      sections: [
        {
          heading: "The problem",
          body: [
            "Job sites are dangerous, and no one can watch every camera. Our $2M NSF-funded research team at UNC Charlotte's TeCSAR Lab had AI that could analyze video in real time. The people keeping workers safe needed it on their phones, in a form they could act on.",
          ],
        },
        {
          heading: "Constraints",
          body: [
            "Real time: a late alert is a useless alert. Privacy: this was video of real people in a real city, so the analytics had to be privacy-preserving by design. Field conditions: it had to work on an actual job site, not just in the lab.",
          ],
        },
        {
          heading: "What I built",
          body: [
            "I designed the UI/UX in Figma and built the Flutter prototype. Behind it, I built the cloud backend on Firebase and AWS (AppSync, Amplify, DynamoDB, SNS) to move real-time data from the analytics to the app, and used Python and SQL to detect anomalies in that data.",
            "The key tradeoff: privacy over raw footage. The app shows what's happening on site, not who's doing it.",
          ],
        },
        {
          heading: "Result",
          body: [
            "We tested it end to end on a job site in Uptown Charlotte. The research produced 2 publications, including a 2025 journal paper in Internet of Things on its real-world evaluation.",
          ],
        },
      ],
      links: [
        { label: "Paper: From Lab to Field (Internet of Things, 2025)", href: "https://doi.org/10.1016/j.iot.2025.101716" },
        { label: "Paper: Enhancing Situational Awareness in Surveillance (arXiv, 2023)", href: "https://arxiv.org/abs/2312.05629" },
      ],
    },
    {
      id: "capstone",
      title: "Innovation capstone",
      tag: "Wells Fargo · Program lead",
      summary: "I went to senior executives for real problems, put 150+ analysts on them, and came out with 31 solutions and 5 patent applications.",
      sections: [
        {
          heading: "The problem",
          body: [
            "A big bank has two things in abundance: real business problems and sharp early-career analysts. They rarely meet. Hackathons built on made-up prompts produce demos nobody adopts.",
          ],
        },
        {
          heading: "Constraints",
          body: [
            "A regulated, high-stakes enterprise, so solutions had to be things the business could actually take on. Scale: 150+ analysts across 7 U.S. sites. Disclosure: the problems and patents are confidential, so this write-up stays at the process level.",
          ],
        },
        {
          heading: "What I built",
          body: [
            "The program itself. I pitched senior executives across lines of business to source real problems, then ran the capstone, a FinTech hackathon, across 7 sites. I also led an AI initiative for 60+ employees.",
            "The key tradeoff: start from problems executives already own instead of open-ended ideas. Fewer flashy pitches, more solutions with someone waiting for them.",
          ],
        },
        {
          heading: "Result",
          body: [
            "31 solutions. 5 are now USPTO patent applications being implemented. Prototypes from the program feed 250+ intern projects a year.",
          ],
        },
        {
          heading: "What I'd do next",
          body: [
            "The work didn't stop at demo day. We're tracking the patents through the process, and next summer, intern teams take the 31 solutions and actually build them. That's how innovation sticks at a bank.",
          ],
        },
      ],
      links: [],
    },
  ],
  workbench: [
    {
      title: "Job-search agent (MCP server)",
      status: "In progress",
      description: "An AI agent with tool use that runs a job search for job seekers, with human approval of every application, Gmail integration, and a status dashboard.",
      media: null,
    },
    {
      title: "Stealth AI startup",
      status: "Demo after beta",
      description: "A real-time AI platform that gives people reps at the conversations they dread, for anyone who wants to communicate better.",
      media: null,
    },
    {
      title: "Biomarkers × recovery",
      status: "Exploring",
      description: "Correlating hormone and biomarker levels with training, recovery, and body composition, starting with my own bodybuilding data, for athletes who want to know what their bloodwork means.",
      media: null,
    },
  ],
};

/*
 * SPEAKING page.
 *   talks    [{ title, event, date, description: [..], image: { src, alt } | null, links: [] }]
 *   topics   [..short strings]
 *   youtube  { label, description, href, image: { src, alt } }
 */
window.SPEAKING = {
  title: "Speaking",
  lede: "I talk about careers, innovation, and mindset, to rooms of 300+ and to interns on day one. I'm looking for more stages. If you're putting together an event, reach out.",
  talks: [
    {
      title: "Intern Induction",
      event: "Walt Disney World",
      date: "",
      description: [
        "I spoke to 250+ interns on business etiquette and gave career advice on how to make the most of an internship.",
      ],
      image: { src: "assets/img/speaking-disney.webp", alt: "Lauren on stage on a panel at the Walt Disney World intern induction, with the audience in the foreground" },
      links: [],
    },
    {
      title: "Career advice for interns",
      event: "Wells Fargo",
      date: "",
      description: ["I presented career advice to a room of Wells Fargo interns."],
      image: { src: "assets/img/speaking-room.webp", alt: "Lauren presenting career advice to a room of Wells Fargo interns" },
      links: [],
    },
    {
      title: "Innovation panels & podcasts",
      event: "Wells Fargo and beyond",
      date: "",
      description: ["Sharing career advice and lessons on innovation with audiences of 300+."],
      image: null,
      links: [],
    },
  ],
  topics: [
    "Business etiquette",
    "Making the most of an internship",
    "Innovation and problem-sourcing",
    "Career growth",
    "Leadership and mindset",
  ],
  youtube: {
    label: "Watch on YouTube",
    description: "Videos where I share my philosophy on life and my best advice. Start here if you want to hear how I think.",
    href: "https://www.youtube.com/@lauren_bourque",
    image: { src: "assets/img/youtube.webp", alt: "Lauren sitting cross-legged, mid-sentence, talking to the camera" },
  },
};

/*
 * CONTACT ("Let's Get Coffee") page. Calendar button first, email beneath. No form.
 */
window.CONTACT = {
  title: "Let's Get Coffee",
  lede: "Hiring, building something, or planning an event? Pick a time and let's talk.",
  calendarLabel: "Book a coffee chat",
  emailLabel: "Or email me",
};

/*
 * REFLECTIONS — blog posts. The page sorts them newest first by date.
 * Empty on purpose: the Reflections tab stays hidden until a real post exists.
 *
 * Post fields
 *   slug     short id for the URL: reflections.html?post=my-slug (lowercase, dashes)
 *   title    the post title (also the browser tab title)
 *   date     "YYYY-MM-DD"
 *   tags     ids from TAGS below, e.g. ["tech", "communication"]
 *   excerpt  one or two sentences for the list and for search/social previews
 *   reading  optional, for "what I've been reading" posts: { title, author, href }
 *   body     a list of blocks, in order. Each block is one of:
 *              "A paragraph. **bold**, *italic* and [link text](https://example.com) work."
 *              { h: "A subheading" }
 *              { quote: "The quoted words.", cite: "Who said it" }
 *              { img: "assets/img/photo.webp", alt: "What the photo shows" }
 *              { list: ["First point", "Second point"] }
 *
 * Example to copy (remove the // marks and put it inside the [ ] below):
 *
 * {
 *   slug: "what-i-learned-shipping",
 *   title: "What I learned shipping my first agent",
 *   date: "2026-12-01",
 *   tags: ["tech", "communication"],
 *   excerpt: "One sentence that makes someone want to read the rest.",
 *   reading: { title: "Book title", author: "Author name", href: "https://example.com/book" },
 *   body: [
 *     "First paragraph, with **bold**, *italic* and a [link](https://example.com).",
 *     { h: "A subheading" },
 *     "Another paragraph.",
 *     { quote: "A line worth quoting.", cite: "Someone wise" },
 *     { img: "assets/img/photo.webp", alt: "What the photo shows" },
 *     { list: ["First point", "Second point", "Third point"] },
 *   ],
 * },
 */
window.POSTS = [
  // LOCAL PREVIEW ONLY: sample posts so Lauren can see the layout. Never commit these.
  {
    slug: "sample-hip-surgery-to-stage",
    title: "From crutches to a bodybuilding stage",
    date: "2026-11-18",
    tags: ["health", "philosophy"],
    excerpt: "Sample post. What a year of rebuilding after hip surgery taught me about doing hard things on purpose.",
    body: [
      "In January I was on crutches after major hip surgery. On **December 5** I step on a bodybuilding stage.",
      { h: "The plan was boring" },
      "Nobody wants to hear it, but the plan was boring. Show up, log it, recover, repeat.",
      { list: ["Train 5 days a week", "Track sleep and recovery", "Change one variable at a time"] },
      { quote: "You don't find yourself. You create yourself.", cite: "Me, to anyone who'll listen" },
      "The tools were already there. I just had to use them.",
    ],
  },
  {
    slug: "sample-agents-in-legacy-code",
    title: "What AI coding agents are actually good at in legacy code",
    date: "2026-11-02",
    tags: ["tech"],
    excerpt: "Sample post. Notes from migrating 20-year-old batch jobs with an AI coding agent in the loop.",
    body: [
      "Everyone asks if AI agents can rewrite old systems. The honest answer: *some of it*, if a human owns the plan.",
      { h: "Where it helped" },
      { list: ["Reading code nobody had touched in years", "Drafting the first pass of a migration", "Writing the boring tests"] },
      { h: "Where it didn't" },
      "Knowing which weird behavior was a bug and which one a client depended on. That part is still people.",
    ],
  },
  {
    slug: "sample-reading-crucial-conversations",
    title: "What I'm reading: the conversations we dread",
    date: "2026-10-20",
    tags: ["communication", "philosophy"],
    excerpt: "Sample post. A book about hard conversations, and why practice beats preparation.",
    reading: { title: "Crucial Conversations", author: "Patterson, Grenny, McMillan & Switzler", href: "https://www.google.com/search?q=Crucial+Conversations" },
    body: [
      "Most of us prepare for hard conversations by rehearsing in the shower. It doesn't work.",
      "This book's big idea: when stakes are high, make it **safe** to keep talking.",
      { quote: "The best rehearsal is a real rep.", cite: "Sample quote" },
      "That idea is a big part of why I'm building what I'm building.",
    ],
  },
  {
    slug: "sample-sourcing-problems-from-executives",
    title: "How to get executives to hand you their real problems",
    date: "2026-09-30",
    tags: ["communication", "tech"],
    excerpt: "Sample post. What I learned pitching senior leaders for the innovation capstone.",
    body: [
      "Executives don't hand you problems because you asked nicely. They hand them over when you show you'll do something with them.",
      { list: ["Come with a timeline", "Ask what keeps them up at night, then shut up", "Report back, even when it's small"] },
      "That's how 150+ analysts ended up with 31 real problems to solve.",
    ],
  },
];

/* The fixed set of tags. Posts refer to them by id. */
window.TAGS = [
  { id: "tech", label: "Tech" },
  { id: "philosophy", label: "Philosophy" },
  { id: "health", label: "Health & Wellness" },
  { id: "communication", label: "Communication" },
];
