const sections = {
  about: {
    title: "About",
    html: `
      <p>
        I am a Data Scientist and AI Engineer with a Master's degree in Data Science,
        specializing in deep learning and natural language processing. My current work
        focuses on building large language model (LLM) solutions in vertical domains,
        combining research with production-grade systems.
      </p>
      <p>
        I enjoy turning complex, noisy data into robust AI products – from research
        prototypes to deployed applications – and I am currently pursuing a PhD on
        AI-driven technologies applied to Italian cultural heritage.
      </p>
    `,
  },
  experience: {
    title: "Experience",
    html: `
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">AI Engineer · Stat4Value</div>
            <div class="detail-item-meta">10/2024 – Present · Italy</div>
          </div>
          <div class="detail-item-body">
            <p>
              Design and implement AI-powered applications that integrate LLMs and ML models,
              process and analyze large datasets, and build intelligent search and recommendation
              systems, including solutions on Google Cloud Storage (GCS).
            </p>
            <div class="tag-row">
              <span class="tag">LLMs</span>
              <span class="tag">Recommender systems</span>
              <span class="tag">GCS</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">ML Engineer · Aigot</div>
            <div class="detail-item-meta">02/2024 – 06/2024 · Pisa, Italy</div>
          </div>
          <div class="detail-item-body">
            <p>
              Built and evaluated machine learning pipelines for NLP tasks, including
              named entity recognition and language model compression for efficient
              deployment in production environments.
            </p>
            <div class="tag-row">
              <span class="tag">ML</span>
              <span class="tag">NLP</span>
              <span class="tag">Model compression</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Data Scientist Intern · Expert.ai</div>
            <div class="detail-item-meta">03/2023 – 12/2023 · Siena, Italy</div>
          </div>
          <div class="detail-item-body">
            <p>
              Contributed to NLP and language technologies, including work on large language models,
              model compression, and production-oriented ML pipelines in a vertical domain.
            </p>
            <div class="tag-row">
              <span class="tag">NLP</span>
              <span class="tag">LLMs</span>
              <span class="tag">ML</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Junior Software Developer · ANKAREF</div>
            <div class="detail-item-meta">05/2021 – 09/2021 · Ankara, Türkiye</div>
          </div>
          <div class="detail-item-body">
            <p>
              Developed web applications with C# backends and Angular frontends, and
              worked on IoT-focused solutions using AWS for deployment and management.
            </p>
            <div class="tag-row">
              <span class="tag">C#</span>
              <span class="tag">Angular</span>
              <span class="tag">AWS</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Geomatics Engineer · RKSOFT</div>
            <div class="detail-item-meta">04/2020 – 04/2021 · Ankara, Türkiye</div>
          </div>
          <div class="detail-item-body">
            <p>
              Worked on GIS applications and AI-driven object recognition on satellite imagery,
              covering data labelling, aerial imagery analysis and visualization.
            </p>
            <div class="tag-row">
              <span class="tag">GIS</span>
              <span class="tag">Computer vision</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  education: {
    title: "Education",
    html: `
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">PhD candidate · University of Padua</div>
            <div class="detail-item-meta">09/2024 – Present</div>
          </div>
          <div class="detail-item-body">
            <p>
              PhD project on enhancing Italian cultural heritage using AI-driven technologies,
              with implementations based on Amazon Bedrock and LLM-based systems.
            </p>
            <div class="tag-row">
              <span class="tag">Cultural heritage</span>
              <span class="tag">Amazon Bedrock</span>
              <span class="tag">Google Cloud</span>
              <span class="tag">LLMs</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">MSc in Data Science · University of Padua</div>
            <div class="detail-item-meta">2021 – 2024</div>
          </div>
          <div class="detail-item-body">
            <p>
              Master's in Data Science with specialization in deep learning and natural language
              processing, including hands-on projects with LLMs, sentiment analysis and AI
              applications.
            </p>
            <div class="tag-row">
              <span class="tag">Deep learning</span>
              <span class="tag">Large language models</span>
              <span class="tag">Statistics</span>
              <span class="tag">Neural networks</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">BSc in Geomatics Engineering · Hacettepe University</div>
            <div class="detail-item-meta">2015 – 2020</div>
          </div>
          <div class="detail-item-body">
            <p>
              Undergraduate studies in geomatics and geospatial technologies, with projects in
              GIS, remote sensing and spatial analysis.
            </p>
          </div>
        </div>
      </div>
    `,
  },
  projects: {
    title: "Selected projects",
    html: `
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Buyer Persona Agent · Sentiment Analysis</div>
          </div>
          <div class="detail-item-body">
            <p>
              Flask web application for product managers to chat with synthetic consumers grounded
              in HB-MNL utility models. Managers create projects, calibrate agentic personas with
              feature sliders, conduct first-person interviews via Gemini on Vertex AI, and run
              portfolio- and session-level sentiment analysis on saved conversations — with
              charts, aspect scoring and persistence on Google Cloud Storage.
            </p>
            <div class="tag-row">
              <span class="tag">Vertex AI</span>
              <span class="tag">Gemini</span>
              <span class="tag">Sentiment analysis</span>
              <span class="tag">HB-MNL</span>
              <span class="tag">GCS</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Fiorentina ACF Sentiment Analysis Chatbot · ViolaPulse</div>
          </div>
          <div class="detail-item-body">
            <p>
              Sentiment analysis web application for Fiorentina fan comments from Instagram and X.
              Built hybrid classification (keyword matching + AI) with nine football-specific
              emotion categories, Italian NLP using spaCy, time-series visualisations and
              AI-generated insights via AWS Bedrock, with caching and real-time dashboards for
              club management.
            </p>
            <div class="tag-row">
              <span class="tag">Sentiment analysis</span>
              <span class="tag">spaCy</span>
              <span class="tag">AWS Bedrock</span>
              <span class="tag">Dashboards</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">
              Automated Annotation of Product Attributes and Customer Values
            </div>
          </div>
          <div class="detail-item-body">
            <p>
              System for automatically annotating Product Attributes (PA) and Customer Values (CV)
              in Italian customer reviews using LLMs. Evaluated zero-shot, few-shot and retrieval
              augmented generation (RAG) prompting strategies across models such as Mistral,
              Llama 3 and Claude Haiku. Presented at ASA 2025 Conference.
            </p>
            <div class="tag-row">
              <span class="tag">LLMs</span>
              <span class="tag">RAG</span>
              <span class="tag">Prompting</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Research Assistant Chatbot</div>
          </div>
          <div class="detail-item-body">
            <p>
              Web application to help researchers analyse academic papers. Uses Elasticsearch for
              semantic search, Google Vertex AI (Gemini) for summaries and thematic analysis,
              and Google Cloud Storage (GCS) for document management. Includes keyword and
              time-filter search, AI-generated literature reviews with citations, PDF upload and
              processing, conversation history and authenticated user experience.
            </p>
            <div class="tag-row">
              <span class="tag">Vertex AI</span>
              <span class="tag">Elasticsearch</span>
              <span class="tag">Semantic search</span>
              <span class="tag">GCS</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Named Entity Recognition in Vertical Domain</div>
          </div>
          <div class="detail-item-body">
            <p>
              Thesis work on NER in a specialized vertical domain using large language models.
              Explored model compression methods such as Fast Vocabulary Transfer (FVT) and
              compared them with traditional models through pretraining, fine-tuning and
              k-fold cross-validation.
            </p>
            <div class="tag-row">
              <span class="tag">NER</span>
              <span class="tag">Model compression</span>
              <span class="tag">BERT</span>
              <span class="tag">RoBERTa</span>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-item-header">
            <div class="detail-item-title">Agentic LLM Evaluation Intelligence Pipeline</div>
          </div>
          <div class="detail-item-body">
            <p>
              Multi-agent system that continuously tracks open-web LLM evaluation signals and
              turns them into production-ready daily briefings. Built an orchestrated flow where
              one agent collects and ranks benchmark-relevant sources, another synthesizes concise
              technical reports with model-aware prompting, and a publishing agent converts outputs
              into a static website while distribution agents deliver summaries to Telegram.
              Includes memory-driven personalization, token/cost tracking, and a secure local
              dashboard for monitoring runs, prompts, usage and operational settings.
            </p>
            <div class="tag-row">
              <span class="tag">Multi-agent orchestration</span>
              <span class="tag">LLM evaluation</span>
              <span class="tag">Automated publishing</span>
              <span class="tag">Telegram delivery</span>
              <span class="tag">Flask dashboard</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  skills: {
    title: "Skills & tools",
    html: `
      <p>
        I work across the full lifecycle of AI products: data collection, modelling, evaluation,
        deployment and iteration. My recent focus is on LLM applications, evaluation and
        optimization.
      </p>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-item-title">Languages & ML stack</div>
          <div class="detail-item-body">
            <p>Python, R, TensorFlow, Keras, PyTorch, scikit-learn, NLP and computer vision.</p>
            <div class="tag-row">
              <span class="tag">Python</span>
              <span class="tag">PyTorch</span>
              <span class="tag">TensorFlow</span>
              <span class="tag">Keras</span>
            </div>
          </div>
        </div>
        <div class="detail-item">
          <div class="detail-item-title">Data & analytics</div>
          <div class="detail-item-body">
            <p>SQL, MongoDB, Tableau, Power BI, RStudio, statistical modelling.</p>
            <div class="tag-row">
              <span class="tag">SQL</span>
              <span class="tag">MongoDB</span>
              <span class="tag">Tableau</span>
              <span class="tag">Power BI</span>
            </div>
          </div>
        </div>
        <div class="detail-item">
          <div class="detail-item-title">MLOps & cloud</div>
          <div class="detail-item-body">
            <p>Docker, AWS (including Bedrock), Google Cloud and GCS, deployment pipelines.</p>
            <div class="tag-row">
              <span class="tag">Docker</span>
              <span class="tag">AWS</span>
              <span class="tag">Bedrock</span>
              <span class="tag">GCP</span>
            </div>
          </div>
        </div>
        <div class="detail-item">
          <div class="detail-item-title">Other</div>
          <div class="detail-item-body">
            <p>Web development with C#, Angular and frontend work on AWS for IoT solutions.</p>
            <div class="tag-row">
              <span class="tag">C#</span>
              <span class="tag">Angular</span>
              <span class="tag">IoT</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  contact: {
    title: "Contact",
    html: `
      <p>
        If you are interested in collaborating, hiring, or discussing research and applied AI,
        feel free to reach out.
      </p>
      <ul>
        <li>Email: <a href="mailto:selekmahir@gmail.com">selekmahir@gmail.com</a></li>
        <li>Phone: <a href="tel:+393519116895">+39 351 911 6895</a></li>
        <li>Location: Padua, Italy</li>
        <li>
          LinkedIn:
          <a href="https://www.linkedin.com/in/mahir-selek/" target="_blank" rel="noopener noreferrer"
            >linkedin.com/in/mahir-selek</a
          >
        </li>
        <li>
          GitHub:
          <a href="https://github.com/MahirSelek" target="_blank" rel="noopener noreferrer"
            >github.com/MahirSelek</a
          >
        </li>
      </ul>
      <p>
        You can also request my full CV or additional project details via email.
      </p>
    `,
  },
};

function setSection(key) {
  const section = sections[key];
  if (!section) return;

  const titleEl = document.getElementById("detail-title");
  const contentEl = document.getElementById("detail-content");

  titleEl.textContent = section.title;
  contentEl.innerHTML = section.html;
}

function initCards() {
  const cards = document.querySelectorAll(".card[data-section]");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const key = card.getAttribute("data-section");
      setSection(key);
    });
  });

  setSection("about");
}

document.addEventListener("DOMContentLoaded", initCards);

