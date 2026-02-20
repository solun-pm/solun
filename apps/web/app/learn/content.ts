export type LearnSection = {
  title: string;
  paragraphs: string[];
};

export type LearnArticle = {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  sections: LearnSection[];
  related: string[];
};

export const learnArticles: LearnArticle[] = [
  {
    slug: "secure-paste-sharing",
    title: "Secure Paste Sharing",
    description: "A practical guide to secure paste sharing, when to use it, and how to reduce leaks.",
    intro: [
      "Secure paste sharing means limiting who can read a message and for how long.",
      "Solun focuses on short lifetimes, strong encryption, and deliberate reveals so secrets do not linger."
    ],
    sections: [
      {
        title: "Security goals",
        paragraphs: [
          "Start by minimizing retention and exposure. The shorter a secret lives, the less likely it leaks.",
          "Use encryption, expiration, and burn after read together to reduce risk from storage, logs, and forwards."
        ]
      },
      {
        title: "Quick vs Secure mode",
        paragraphs: [
          "Quick mode encrypts on the server for speed. It is convenient, but the server holds the key.",
          "Secure mode encrypts in the browser. The key stays in the URL fragment, so the server never sees it."
        ]
      },
      {
        title: "Expiration strategy",
        paragraphs: [
          "Choose the shortest TTL that still allows the recipient to act. One hour is ideal for credentials.",
          "If you must use a longer TTL, keep the content low risk and avoid reusing the same link."
        ]
      },
      {
        title: "Sharing hygiene",
        paragraphs: [
          "Send the link in a different channel than the context. This makes accidental leaks less likely.",
          "Warn recipients about link previews and prefetching. Ask them to open in a browser they control."
        ]
      }
    ],
    related: ["end-to-end-encryption-basics", "burn-after-read-and-expiration", "how-to-share-secrets", "threat-model"]
  },
  {
    slug: "end-to-end-encryption-basics",
    title: "End-to-End Encryption Basics",
    description: "Understand how end-to-end encryption works in the browser and what it protects.",
    intro: [
      "End-to-end encryption means only the sender and recipient can read the content.",
      "In Solun secure mode, the browser generates the key and keeps it out of the server."
    ],
    sections: [
      {
        title: "Key generation and storage",
        paragraphs: [
          "The browser uses Web Crypto to create a random AES-256-GCM key.",
          "That key is placed in the URL fragment, which never leaves the browser during HTTP requests."
        ]
      },
      {
        title: "What the server stores",
        paragraphs: [
          "The server only receives ciphertext and metadata like size, chunk order, and expiration.",
          "Without the fragment, the server cannot decrypt the data even if storage is accessed."
        ]
      },
      {
        title: "Integrity and authenticity",
        paragraphs: [
          "AES-GCM provides integrity checks so tampering is detected during decryption.",
          "However, a forwarded link still grants access, so link handling remains critical."
        ]
      },
      {
        title: "Limitations",
        paragraphs: [
          "End-to-end encryption does not protect against device compromise or screenshots.",
          "Pair secure mode with short TTLs and burn-after-read when content is highly sensitive."
        ]
      }
    ],
    related: ["secure-paste-sharing", "secure-file-sharing", "private-link-sharing", "threat-model"]
  },
  {
    slug: "burn-after-read-and-expiration",
    title: "Burn-After-Read and Expiration",
    description: "Why expiring links and burn-after-read reduce exposure for sensitive data.",
    intro: [
      "The safest secret is the one that disappears quickly.",
      "Expiration and burn-after-read cut down the time window where a leak matters."
    ],
    sections: [
      {
        title: "Expiration windows",
        paragraphs: [
          "Short TTLs are ideal for passwords, API keys, or one-time access links.",
          "Longer TTLs should be reserved for low-risk files where convenience matters more."
        ]
      },
      {
        title: "Burn-after-read behavior",
        paragraphs: [
          "Burn-after-read deletes the content right after the first successful access.",
          "Be careful with clients that prefetch links, since they can trigger an early burn."
        ]
      },
      {
        title: "Operational tradeoffs",
        paragraphs: [
          "Short lifetimes require coordination. Tell recipients when to open the link.",
          "If a link expires too early, create a new one instead of extending the old one."
        ]
      },
      {
        title: "Policy guidance",
        paragraphs: [
          "Teams should set defaults for TTL and burn-after-read based on risk level.",
          "Use a documented policy so everyone shares in the same secure way."
        ]
      }
    ],
    related: ["secure-paste-sharing", "secure-file-sharing", "private-link-sharing", "compliance-and-retention"]
  },
  {
    slug: "secure-file-sharing",
    title: "Secure File Sharing",
    description: "How chunked encryption, presigned uploads, and safe downloads work for files.",
    intro: [
      "Files are larger and require careful handling to stay fast and secure.",
      "Solun encrypts each chunk with a unique IV and keeps keys out of the server in secure mode."
    ],
    sections: [
      {
        title: "Chunking and encryption",
        paragraphs: [
          "Files are split into fixed-size chunks before upload.",
          "Each chunk uses the same key but a different random IV to avoid reuse risk."
        ]
      },
      {
        title: "Direct-to-storage uploads",
        paragraphs: [
          "The browser uploads encrypted chunks directly to storage using presigned URLs.",
          "The API only sees metadata, never the file contents in secure mode."
        ]
      },
      {
        title: "Safe downloads",
        paragraphs: [
          "Downloads fetch metadata, stream encrypted chunks, and decrypt locally in the browser.",
          "After assembly, the file is offered as a download and can auto-start on reveal."
        ]
      },
      {
        title: "Reliability and resume",
        paragraphs: [
          "Upload progress is saved per chunk so a refresh can resume from the last successful part.",
          "Pending uploads are cleaned automatically, and expired files are removed by policy."
        ]
      }
    ],
    related: ["end-to-end-encryption-basics", "troubleshooting-downloads", "burn-after-read-and-expiration", "private-link-sharing"]
  },
  {
    slug: "threat-model",
    title: "Threat Model for Private Sharing",
    description: "Define risks, choose the right mode, and set safe defaults for your use case.",
    intro: [
      "A threat model clarifies which risks matter and which controls are enough.",
      "The right choice depends on the data, the audience, and the sharing channel."
    ],
    sections: [
      {
        title: "Define the asset",
        paragraphs: [
          "Identify what you are sharing and how sensitive it is.",
          "Credentials, personal data, and internal documents all deserve stronger controls."
        ]
      },
      {
        title: "Understand adversaries",
        paragraphs: [
          "Common risks include link forwarding, compromised devices, or exposure in storage logs.",
          "Clarify whether you are protecting against the server itself or only accidental leaks."
        ]
      },
      {
        title: "Map controls to risks",
        paragraphs: [
          "Use secure mode when you need protection from server-side exposure.",
          "Use quick mode when speed matters and server-side encryption is acceptable."
        ]
      },
      {
        title: "Communicate the plan",
        paragraphs: [
          "Tell recipients about expiration, burn-after-read, and any prefetch risks.",
          "Make the rules explicit so the share is both secure and predictable."
        ]
      }
    ],
    related: ["secure-paste-sharing", "end-to-end-encryption-basics", "private-link-sharing", "compliance-and-retention"]
  },
  {
    slug: "private-link-sharing",
    title: "Private Link Sharing",
    description: "How to share sensitive links safely and keep keys out of logs.",
    intro: [
      "Links can leak through previews, logs, or accidental forwarding.",
      "Solun keeps keys in URL fragments so they never reach the server."
    ],
    sections: [
      {
        title: "Why fragments matter",
        paragraphs: [
          "URL fragments are not sent to servers during HTTP requests.",
          "This keeps decryption keys out of server logs, analytics, and proxies."
        ]
      },
      {
        title: "Avoid link previews",
        paragraphs: [
          "Some chat clients prefetch URLs, which can trigger burns early.",
          "Prefer channels that do not expand links, or disable previews when possible."
        ]
      },
      {
        title: "Separate context",
        paragraphs: [
          "Send the link and the instructions in different messages or channels.",
          "This reduces the chance of accidental leaks if one message is forwarded."
        ]
      },
      {
        title: "Storage hygiene",
        paragraphs: [
          "Avoid saving sensitive links in shared docs or long-lived ticket systems.",
          "If a link must be stored, keep the TTL short and rotate secrets afterward."
        ]
      }
    ],
    related: ["secure-paste-sharing", "burn-after-read-and-expiration", "how-to-share-secrets", "troubleshooting-downloads"]
  },
  {
    slug: "compliance-and-retention",
    title: "Compliance and Retention Basics",
    description: "Retention limits, deletion workflows, and privacy-first compliance for shared data.",
    intro: [
      "Retention limits are a core part of privacy-first sharing.",
      "Solun enforces maximum TTLs so sensitive data cannot live forever."
    ],
    sections: [
      {
        title: "Why retention matters",
        paragraphs: [
          "Long-lived data increases exposure and compliance risk.",
          "Short retention reduces the impact of leaks and limits audit scope."
        ]
      },
      {
        title: "Deletion workflows",
        paragraphs: [
          "Expired objects are removed by the API and storage lifecycle rules.",
          "This two-layer cleanup makes retention predictable even if a job fails."
        ]
      },
      {
        title: "Audit readiness",
        paragraphs: [
          "Document your default TTLs and burn-after-read behavior in policy.",
          "Keep sharing rules simple so teams can follow them consistently."
        ]
      },
      {
        title: "Choose the right mode",
        paragraphs: [
          "Secure mode keeps keys client-side and fits regulated or sensitive data.",
          "Quick mode is best for low-risk shares where speed is critical."
        ]
      }
    ],
    related: ["burn-after-read-and-expiration", "secure-file-sharing", "threat-model", "no-tracking-privacy"]
  },
  {
    slug: "pastebin-alternative",
    title: "Pastebin Alternative: What to Look For",
    description: "A fair checklist for evaluating paste sharing tools that prioritize privacy.",
    intro: [
      "Most paste tools optimize for convenience, not privacy.",
      "If you need privacy-first sharing, use a clear checklist before you choose a tool."
    ],
    sections: [
      {
        title: "Feature checklist",
        paragraphs: [
          "Look for end-to-end encryption, strict expirations, and burn-after-read options.",
          "A strong tool should make secure defaults easy, not optional."
        ]
      },
      {
        title: "Transparency and trust",
        paragraphs: [
          "Open source and clear documentation build confidence in how data is handled.",
          "Check for documented retention limits and lifecycle cleanup policies."
        ]
      },
      {
        title: "Link design",
        paragraphs: [
          "Short links reduce friction, while URL fragments keep keys out of servers.",
          "Custom domains help recipients trust the destination before opening."
        ]
      },
      {
        title: "Operational safety",
        paragraphs: [
          "Look for abuse prevention, rate limits, and file size controls.",
          "Safety mechanisms should exist even if you never notice them."
        ]
      }
    ],
    related: ["secure-paste-sharing", "no-tracking-privacy", "end-to-end-encryption-basics", "compliance-and-retention"]
  },
  {
    slug: "sharing-from-teams",
    title: "Sharing Secrets in Teams",
    description: "Team-friendly practices for sharing passwords, keys, and internal files safely.",
    intro: [
      "Teams share secrets constantly, so process matters as much as tooling.",
      "A simple workflow reduces leaks and makes incident response faster."
    ],
    sections: [
      {
        title: "Process hygiene",
        paragraphs: [
          "Use secure mode by default for credentials and rotate them regularly.",
          "Avoid long-lived channels like email threads or shared docs for secrets."
        ]
      },
      {
        title: "Least access",
        paragraphs: [
          "Share the minimum information needed for the task.",
          "When possible, send to one person instead of a group or channel."
        ]
      },
      {
        title: "Incident response",
        paragraphs: [
          "If a link might be exposed, revoke it and rotate the secret immediately.",
          "Keep a playbook so teams respond quickly without debate."
        ]
      },
      {
        title: "Onboarding and training",
        paragraphs: [
          "Teach new team members how to use secure sharing from day one.",
          "Provide templates for how to describe TTL, burn-after-read, and timing."
        ]
      }
    ],
    related: ["how-to-share-secrets", "secure-paste-sharing", "compliance-and-retention", "private-link-sharing"]
  },
  {
    slug: "how-to-share-secrets",
    title: "How to Share Secrets Safely",
    description: "A simple, repeatable workflow for sharing passwords and API keys securely.",
    intro: [
      "Sharing secrets safely is about minimizing exposure and maximizing control.",
      "This guide provides a workflow you can use every time."
    ],
    sections: [
      {
        title: "Before you share",
        paragraphs: [
          "Classify the secret, choose secure mode, and set a short expiration.",
          "Decide whether burn-after-read is appropriate for the risk level."
        ]
      },
      {
        title: "Share safely",
        paragraphs: [
          "Send the link in a channel that does not prefetch URLs.",
          "Share instructions separately so the context is not bundled with the link."
        ]
      },
      {
        title: "After access",
        paragraphs: [
          "Confirm the recipient accessed the secret successfully.",
          "Rotate credentials if there is any chance of exposure."
        ]
      },
      {
        title: "Common mistakes",
        paragraphs: [
          "Avoid reusing old links or extending TTL just to make things easier.",
          "Do not paste secrets directly into chat or issue trackers."
        ]
      }
    ],
    related: ["secure-paste-sharing", "burn-after-read-and-expiration", "private-link-sharing", "sharing-from-teams"]
  },
  {
    slug: "troubleshooting-downloads",
    title: "Troubleshooting Secure Downloads",
    description: "Fix common download errors in secure file sharing and finish the transfer.",
    intro: [
      "Most download problems come from browser protections, expired links, or unstable networks.",
      "These checks resolve the majority of issues quickly."
    ],
    sections: [
      {
        title: "CORS and blocked requests",
        paragraphs: [
          "Ensure storage CORS allows GET and HEAD and exposes the ETag header.",
          "Verify the content domain matches the presigned URL and the request origin."
        ]
      },
      {
        title: "Expired or burned links",
        paragraphs: [
          "If the metadata fetch returns 404, the link is gone by design.",
          "Generate a new share instead of trying to revive an expired link."
        ]
      },
      {
        title: "Large files and unstable networks",
        paragraphs: [
          "Pause heavy network activity and retry the download if it stalls.",
          "Use the resume feature so you do not restart from zero after a refresh."
        ]
      },
      {
        title: "Browser limits",
        paragraphs: [
          "Make sure the device has enough disk space for the final file.",
          "Disable aggressive privacy extensions that block large binary downloads."
        ]
      }
    ],
    related: ["secure-file-sharing", "burn-after-read-and-expiration", "private-link-sharing", "secure-paste-sharing"]
  },
  {
    slug: "no-tracking-privacy",
    title: "No-Tracking and Privacy by Design",
    description: "How Solun avoids tracking and reduces metadata exposure for private sharing.",
    intro: [
      "Privacy is more than encryption. It also means minimizing tracking and metadata leakage.",
      "This guide explains how Solun reduces exposure while still staying usable."
    ],
    sections: [
      {
        title: "Minimize what is collected",
        paragraphs: [
          "Only the minimum metadata needed to deliver the share is stored.",
          "No analytics are required for core functionality, keeping logs lean and low risk."
        ]
      },
      {
        title: "Keep keys out of servers",
        paragraphs: [
          "Secure mode stores decryption keys in the URL fragment, which is never sent to the server.",
          "This prevents keys from landing in access logs or analytics systems."
        ]
      },
      {
        title: "Short retention by default",
        paragraphs: [
          "Short TTLs and burn-after-read mean data disappears quickly after use.",
          "Retention limits reduce the chance of long-term exposure."
        ]
      },
      {
        title: "Trust signals for recipients",
        paragraphs: [
          "Custom domains help recipients verify they are on a trusted host.",
          "Clear UI messaging explains expiration and burn-after-read expectations."
        ]
      }
    ],
    related: ["secure-paste-sharing", "end-to-end-encryption-basics", "compliance-and-retention", "pastebin-alternative"]
  }
];

export const learnArticleMap = new Map(learnArticles.map((article) => [article.slug, article]));

export function getArticle(slug: string): LearnArticle | undefined {
  return learnArticleMap.get(slug);
}

export const learnSlugs = learnArticles.map((article) => article.slug);
