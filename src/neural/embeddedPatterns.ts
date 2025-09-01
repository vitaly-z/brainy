/**
 * 🧠 BRAINY EMBEDDED PATTERNS
 * 
 * AUTO-GENERATED - DO NOT EDIT
 * Generated: 2025-09-01T16:21:15.650Z
 * Patterns: 220
 * Coverage: 94-98% of all queries
 * 
 * This file contains ALL patterns and embeddings compiled into Brainy.
 * No external files needed, no runtime loading, instant availability!
 */

import type { Pattern } from './patternLibrary.js'

// All 220 patterns embedded directly
export const EMBEDDED_PATTERNS: Pattern[] = [
  {
    "id": "research_on",
    "category": "academic",
    "examples": [
      "research on AI safety",
      "papers about climate change",
      "studies on COVID"
    ],
    "pattern": "(?:research|papers?|studies)\\s+(?:on|about)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "academic"
      }
    },
    "confidence": 0.91
  },
  {
    "id": "aggregation_count",
    "category": "aggregation",
    "examples": [
      "count papers",
      "number of models",
      "how many datasets"
    ],
    "pattern": "(count|number of|how many) (.+)",
    "template": {
      "like": "${2}",
      "aggregate": "count"
    },
    "confidence": 0.9
  },
  {
    "id": "how_many",
    "category": "aggregation",
    "examples": [
      "how many papers about AI",
      "count of documents"
    ],
    "pattern": "(?:how\\s+many|count\\s+of|number\\s+of)\\s+(.+)",
    "template": {
      "like": "${1}",
      "aggregate": "count"
    },
    "confidence": 0.9
  },
  {
    "id": "list_of_all",
    "category": "aggregation",
    "examples": [
      "list of all features",
      "all available options",
      "complete list"
    ],
    "pattern": "(?:list\\s+of\\s+all|all\\s+available|complete\\s+list)\\s+(.+)",
    "template": {
      "like": "${1}",
      "limit": 1000
    },
    "confidence": 0.88
  },
  {
    "id": "aggregation_average",
    "category": "aggregation",
    "examples": [
      "average citations",
      "mean accuracy",
      "average performance"
    ],
    "pattern": "(average|mean) (.+)",
    "template": {
      "like": "${2}",
      "aggregate": "avg"
    },
    "confidence": 0.85
  },
  {
    "id": "aggregation_sum",
    "category": "aggregation",
    "examples": [
      "total citations",
      "sum of parameters",
      "total cost"
    ],
    "pattern": "(total|sum of|sum) (.+)",
    "template": {
      "like": "${2}",
      "aggregate": "sum"
    },
    "confidence": 0.85
  },
  {
    "id": "aggregation_max",
    "category": "aggregation",
    "examples": [
      "highest accuracy",
      "maximum performance",
      "largest model"
    ],
    "pattern": "(highest|maximum|largest|biggest) (.+)",
    "template": {
      "like": "${2}",
      "aggregate": "max"
    },
    "confidence": 0.85
  },
  {
    "id": "aggregation_min",
    "category": "aggregation",
    "examples": [
      "lowest error",
      "minimum cost",
      "smallest model"
    ],
    "pattern": "(lowest|minimum|smallest|least) (.+)",
    "template": {
      "like": "${2}",
      "aggregate": "min"
    },
    "confidence": 0.85
  },
  {
    "id": "average_of",
    "category": "aggregation",
    "examples": [
      "average citations",
      "mean score",
      "median value"
    ],
    "pattern": "(?:average|mean|median)\\s+(?:of\\s+)?(.+)",
    "template": {
      "like": "${1}",
      "aggregate": "average"
    },
    "confidence": 0.85
  },
  {
    "id": "and_but_not",
    "category": "combined",
    "examples": [
      "AI and ML but not deep learning",
      "Python and Django but not Flask"
    ],
    "pattern": "(.+?)\\s+and\\s+(.+?)\\s+but\\s+not\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "not": "${3}"
      }
    },
    "confidence": 0.82
  },
  {
    "id": "combined_complex_1",
    "category": "combined",
    "examples": [
      "recent papers by Hinton with more than 50 citations"
    ],
    "pattern": "recent (.+) by (.+) with more than (\\d+) (.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "from": "${2}"
      },
      "where": {
        "${4}": {
          "greaterThan": "${3}"
        }
      },
      "boost": "recent"
    },
    "confidence": 0.75
  },
  {
    "id": "combined_complex_2",
    "category": "combined",
    "examples": [
      "best machine learning papers from 2023 at Stanford"
    ],
    "pattern": "best (.+) from (\\d{4}) at (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "year": "${2}",
        "organization": "${3}"
      },
      "boost": "popular"
    },
    "confidence": 0.75
  },
  {
    "id": "combined_complex_3",
    "category": "combined",
    "examples": [
      "compare tensorflow and pytorch for computer vision"
    ],
    "pattern": "compare (.+) and (.+) for (.+)",
    "template": {
      "like": [
        "${1}",
        "${2}",
        "${3}"
      ],
      "where": {
        "type": "comparison",
        "domain": "${3}"
      }
    },
    "confidence": 0.75
  },
  {
    "id": "commercial_compare",
    "category": "commercial",
    "examples": [
      "tensorflow vs pytorch",
      "compare BERT and GPT",
      "GPT-3 compared to GPT-4"
    ],
    "pattern": "(.+) (vs|versus|compared to|vs\\.) (.+)",
    "template": {
      "like": [
        "${1}",
        "${3}"
      ],
      "where": {
        "type": "comparison"
      }
    },
    "confidence": 0.95
  },
  {
    "id": "commercial_reviews",
    "category": "commercial",
    "examples": [
      "tensorflow reviews",
      "best practices reviews",
      "model evaluation"
    ],
    "pattern": "(.+) (reviews|ratings|feedback|opinions)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "review"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "commercial_best",
    "category": "commercial",
    "examples": [
      "best machine learning framework",
      "top AI models",
      "best practices"
    ],
    "pattern": "(best|top|greatest|finest) (.+)",
    "template": {
      "like": "${2}",
      "boost": "popular"
    },
    "confidence": 0.9
  },
  {
    "id": "commercial_top_n",
    "category": "commercial",
    "examples": [
      "top 10 models",
      "top 5 papers",
      "best 3 frameworks"
    ],
    "pattern": "(top|best) (\\d+) (.+)",
    "template": {
      "like": "${3}",
      "limit": "${2}",
      "boost": "popular"
    },
    "confidence": 0.9
  },
  {
    "id": "price_cost",
    "category": "commercial",
    "examples": [
      "price of AWS",
      "cost of hosting",
      "pricing for services"
    ],
    "pattern": "(?:price|cost|pricing)\\s+(?:of|for)\\s+(.+)",
    "template": {
      "like": "${1} pricing",
      "where": {
        "type": "commercial"
      }
    },
    "confidence": 0.88
  },
  {
    "id": "free_open_source",
    "category": "commercial",
    "examples": [
      "free alternatives to",
      "open source version",
      "free tools for"
    ],
    "pattern": "(?:free|open\\s+source)\\s+(?:alternatives?\\s+to|version\\s+of|tools?\\s+for)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "license": "free"
      }
    },
    "confidence": 0.87
  },
  {
    "id": "commercial_alternatives",
    "category": "commercial",
    "examples": [
      "tensorflow alternatives",
      "options besides OpenAI",
      "similar to BERT"
    ],
    "pattern": "(.+) (alternatives|options|similar to|like)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "alternative"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "commercial_cheapest",
    "category": "commercial",
    "examples": [
      "cheapest GPU",
      "most affordable cloud",
      "budget options"
    ],
    "pattern": "(cheapest|most affordable|budget|lowest price) (.+)",
    "template": {
      "like": "${2}",
      "orderBy": {
        "price": "asc"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "commercial_pricing",
    "category": "commercial",
    "examples": [
      "GPU pricing",
      "cloud costs",
      "model training costs"
    ],
    "pattern": "(.+) (pricing|price|cost|costs|rates)",
    "template": {
      "like": "${1}",
      "where": {
        "hasField": "price"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "comparative_better",
    "category": "commercial",
    "examples": [
      "is BERT better than GPT",
      "pytorch better than tensorflow"
    ],
    "pattern": "(is )? (.+) better than (.+)",
    "template": {
      "like": [
        "${2}",
        "${3}"
      ],
      "where": {
        "type": "comparison"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "comparative_faster",
    "category": "commercial",
    "examples": [
      "fastest model",
      "quickest training",
      "faster than BERT"
    ],
    "pattern": "(fastest|quickest|faster) (.+)",
    "template": {
      "like": "${2}",
      "orderBy": {
        "speed": "desc"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "comparative_more_accurate",
    "category": "commercial",
    "examples": [
      "most accurate model",
      "higher accuracy than"
    ],
    "pattern": "(most accurate|highest accuracy|more accurate) (.+)",
    "template": {
      "like": "${2}",
      "orderBy": {
        "accuracy": "desc"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "question_which",
    "category": "commercial",
    "examples": [
      "which model is best",
      "which framework to use"
    ],
    "pattern": "which (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "selection"
      }
    },
    "confidence": 0.8
  },
  {
    "id": "comparison_vs",
    "category": "comparative",
    "examples": [
      "Python vs JavaScript",
      "React vs Vue",
      "TensorFlow vs PyTorch"
    ],
    "pattern": "(.+?)\\s+vs\\.?\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "boost": "comparison"
    },
    "confidence": 0.9
  },
  {
    "id": "difference_between",
    "category": "comparative",
    "examples": [
      "difference between AI and ML",
      "what's the difference between React and Angular"
    ],
    "pattern": "(?:difference|differences)\\s+between\\s+(.+?)\\s+and\\s+(.+)",
    "template": {
      "like": "${1} ${2} comparison",
      "boost": "comparison"
    },
    "confidence": 0.88
  },
  {
    "id": "alternative_instead",
    "category": "comparative",
    "examples": [
      "instead of React",
      "alternative to Python",
      "replacement for"
    ],
    "pattern": "(?:instead\\s+of|alternative\\s+to|replacement\\s+for|substitute\\s+for)\\s+(.+)",
    "template": {
      "like": "${1} alternative",
      "boost": "comparison"
    },
    "confidence": 0.88
  },
  {
    "id": "pros_cons",
    "category": "comparative",
    "examples": [
      "pros and cons of React",
      "advantages of Python",
      "benefits of AI"
    ],
    "pattern": "(?:pros\\s+and\\s+cons|advantages?|benefits?|disadvantages?)\\s+(?:of|for)\\s+(.+)",
    "template": {
      "like": "${1} analysis",
      "boost": "comparison"
    },
    "confidence": 0.86
  },
  {
    "id": "benchmark_performance",
    "category": "comparative",
    "examples": [
      "benchmark results",
      "performance comparison",
      "speed test"
    ],
    "pattern": "(?:benchmark|performance|speed\\s+test)\\s+(?:results?|comparison)?\\s*(?:for|of)?\\s*(.+)",
    "template": {
      "like": "${1} benchmark",
      "where": {
        "type": "benchmark"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "contextual_more_like",
    "category": "contextual",
    "examples": [
      "more like this",
      "similar papers",
      "find similar"
    ],
    "pattern": "(more like|similar to|like) (this|that|these)",
    "template": {
      "similar": "__context__"
    },
    "confidence": 0.8
  },
  {
    "id": "contextual_same_but",
    "category": "contextual",
    "examples": [
      "same but newer",
      "same query but from 2023"
    ],
    "pattern": "same (query |search |)but (.+)",
    "template": {
      "__modifier__": "${2}"
    },
    "confidence": 0.75
  },
  {
    "id": "conversational_need",
    "category": "conversational",
    "examples": [
      "I need help with Python",
      "I want to learn React",
      "I'm looking for AI papers"
    ],
    "pattern": "(?:I\\s+need|I\\s+want|I'm\\s+looking\\s+for)\\s+(.+)",
    "template": {
      "like": "${1}"
    },
    "confidence": 0.85
  },
  {
    "id": "conversational_can_you",
    "category": "conversational",
    "examples": [
      "can you find papers",
      "could you show me",
      "would you search for"
    ],
    "pattern": "(?:can|could|would)\\s+you\\s+(?:find|show|search|get)\\s+(?:me\\s+)?(.+)",
    "template": {
      "like": "${1}"
    },
    "confidence": 0.84
  },
  {
    "id": "industry_sector",
    "category": "domain",
    "examples": [
      "fintech applications",
      "healthcare AI",
      "education technology"
    ],
    "pattern": "(?:fintech|healthcare|education|finance|medical|legal|retail)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "industry": "${0}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "academic_citation",
    "category": "domain_specific",
    "domain": "academic",
    "examples": [
      "cite website APA",
      "MLA citation format",
      "Chicago style bibliography"
    ],
    "pattern": "(?:cite|citation)\\s+(.+?)\\s+(?:in\\s+)?(APA|MLA|Chicago|Harvard)",
    "template": {
      "like": "${1} citation ${2}",
      "where": {
        "domain": "academic",
        "type": "citation",
        "style": "${2}"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "academic_peer_reviewed",
    "category": "domain_specific",
    "domain": "academic",
    "examples": [
      "peer reviewed articles on climate change",
      "scholarly articles about AI"
    ],
    "pattern": "(?:peer\\s+reviewed|scholarly)\\s+(?:articles?|papers?)\\s+(?:on|about)\\s+(.+)",
    "template": {
      "like": "${1} peer reviewed",
      "where": {
        "domain": "academic",
        "type": "peer_reviewed"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "academic_journal_impact",
    "category": "domain_specific",
    "domain": "academic",
    "examples": [
      "Nature impact factor",
      "Science journal ranking",
      "PNAS impact factor"
    ],
    "pattern": "(.+?)\\s+(?:impact\\s+factor|journal\\s+ranking)",
    "template": {
      "like": "${1} impact factor",
      "where": {
        "domain": "academic",
        "type": "journal"
      }
    },
    "confidence": 0.92,
    "frequency": "medium"
  },
  {
    "id": "academic_publications",
    "category": "domain_specific",
    "domain": "academic",
    "examples": [
      "Einstein publications",
      "papers by Hinton",
      "Smith et al 2023"
    ],
    "pattern": "(?:(.+?)\\s+publications?|papers?\\s+by\\s+(.+))",
    "template": {
      "like": "${1}${2} publications",
      "where": {
        "domain": "academic",
        "type": "publication"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "academic_research_methodology",
    "category": "domain_specific",
    "domain": "academic",
    "examples": [
      "qualitative research methods",
      "sample size calculation",
      "statistical analysis"
    ],
    "pattern": "(.+?)\\s+(?:research\\s+methods?|methodology)",
    "template": {
      "like": "${1} methodology",
      "where": {
        "domain": "academic",
        "type": "methodology"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "academic_grant_funding",
    "category": "domain_specific",
    "domain": "academic",
    "examples": [
      "NSF grant opportunities",
      "research funding biology",
      "PhD funding"
    ],
    "pattern": "(.+?)\\s+(?:grant|funding)\\s*(?:opportunities)?",
    "template": {
      "like": "${1} funding",
      "where": {
        "domain": "academic",
        "type": "funding"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "ai_llm_models",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "ChatGPT API",
      "Claude vs GPT-4",
      "Llama 2 fine-tuning"
    ],
    "pattern": "(ChatGPT|Claude|GPT-4|Llama|Mistral|Gemini|DALL-E|Stable\\s+Diffusion)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "ai",
        "type": "llm"
      }
    },
    "confidence": 0.95,
    "frequency": "very_high"
  },
  {
    "id": "ai_dataset",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "MNIST dataset",
      "ImageNet download",
      "COCO dataset"
    ],
    "pattern": "(MNIST|ImageNet|COCO|CIFAR|WikiText|GLUE|SQuAD)\\s*(?:dataset)?\\s*(.+)?",
    "template": {
      "like": "${1} dataset ${2}",
      "where": {
        "domain": "ai",
        "type": "dataset"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "ai_pretrained_model",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "BERT pretrained model",
      "download GPT-2",
      "use ResNet50"
    ],
    "pattern": "(BERT|GPT|GPT-2|GPT-3|GPT-4|ResNet|VGG|YOLO|EfficientNet)\\s+(?:pretrained\\s+)?(?:model)?\\s*(.+)?",
    "template": {
      "like": "${1} pretrained ${2}",
      "where": {
        "domain": "ai",
        "type": "pretrained_model"
      }
    },
    "confidence": 0.94,
    "frequency": "very_high"
  },
  {
    "id": "ai_model_training",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "train BERT model",
      "fine-tune GPT",
      "train neural network"
    ],
    "pattern": "(?:train|fine-?tune)\\s+(.+?)\\s*(?:model|network)?",
    "template": {
      "like": "train ${1}",
      "where": {
        "domain": "ai",
        "type": "training"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "ai_framework_comparison",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "TensorFlow vs PyTorch",
      "Keras or TensorFlow",
      "JAX vs PyTorch"
    ],
    "pattern": "(TensorFlow|PyTorch|Keras|JAX|MXNet|Caffe|Theano)\\s+(?:vs\\.?|or)\\s+(.+)",
    "template": {
      "like": "${1} vs ${2}",
      "where": {
        "domain": "ai",
        "type": "framework_comparison"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "ai_prompt_engineering",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "prompt engineering tips",
      "ChatGPT prompts",
      "system prompt examples"
    ],
    "pattern": "(?:prompt\\s+engineering|prompts?|system\\s+prompt)\\s+(.+)",
    "template": {
      "like": "prompt engineering ${1}",
      "where": {
        "domain": "ai",
        "type": "prompt_engineering"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "ai_machine_learning",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "random forest sklearn",
      "neural network PyTorch",
      "CNN TensorFlow"
    ],
    "pattern": "(random\\s+forest|neural\\s+network|CNN|RNN|LSTM|transformer|SVM|k-?means)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "ai",
        "type": "ml_algorithm"
      }
    },
    "confidence": 0.92,
    "frequency": "very_high"
  },
  {
    "id": "ai_nlp_task",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "sentiment analysis Python",
      "named entity recognition",
      "text classification BERT"
    ],
    "pattern": "(sentiment\\s+analysis|NER|named\\s+entity|text\\s+classification|summarization|translation)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "ai",
        "type": "nlp"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "ai_metrics",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "accuracy vs precision",
      "F1 score calculation",
      "ROC curve explained"
    ],
    "pattern": "(accuracy|precision|recall|F1\\s+score|ROC|AUC|loss|perplexity)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "ai",
        "type": "metrics"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "ai_computer_vision",
    "category": "domain_specific",
    "domain": "ai",
    "examples": [
      "object detection YOLO",
      "image segmentation",
      "face recognition OpenCV"
    ],
    "pattern": "(object\\s+detection|image\\s+segmentation|face\\s+recognition|OCR|image\\s+classification)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "ai",
        "type": "computer_vision"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "ecommerce_reviews",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "iPhone 15 reviews",
      "best laptop reviews",
      "Samsung TV ratings"
    ],
    "pattern": "(.+?)\\s+(?:reviews?|ratings?)",
    "template": {
      "like": "${1} reviews",
      "where": {
        "domain": "ecommerce",
        "type": "review"
      }
    },
    "confidence": 0.95,
    "frequency": "high"
  },
  {
    "id": "ecommerce_price_comparison",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "cheapest PS5",
      "best price MacBook",
      "lowest price Nike shoes"
    ],
    "pattern": "(?:cheapest|best\\s+price|lowest\\s+price)\\s+(.+)",
    "template": {
      "like": "${1} price",
      "where": {
        "domain": "ecommerce",
        "sort": "price_asc"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "ecommerce_deals",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "Amazon deals today",
      "Black Friday sales",
      "coupon codes Target"
    ],
    "pattern": "(.+?)\\s+(?:deals?|sales?|coupon\\s+codes?)\\s*(?:today)?",
    "template": {
      "like": "${1} deals",
      "where": {
        "domain": "ecommerce",
        "type": "deals"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "ecommerce_in_stock",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "PS5 in stock",
      "RTX 4090 availability",
      "iPhone 15 where to buy"
    ],
    "pattern": "(.+?)\\s+(?:in\\s+stock|availability|where\\s+to\\s+buy)",
    "template": {
      "like": "${1} availability",
      "where": {
        "domain": "ecommerce",
        "in_stock": true
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "ecommerce_size_chart",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "Nike size chart",
      "ring size guide",
      "clothing size conversion"
    ],
    "pattern": "(.+?)\\s+size\\s+(?:chart|guide|conversion)",
    "template": {
      "like": "${1} size chart",
      "where": {
        "domain": "ecommerce",
        "type": "sizing"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "ecommerce_return_policy",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "Amazon return policy",
      "Walmart refund",
      "exchange policy Best Buy"
    ],
    "pattern": "(.+?)\\s+(?:return\\s+policy|refund|exchange)",
    "template": {
      "like": "${1} return policy",
      "where": {
        "domain": "ecommerce",
        "type": "policy"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "ecommerce_warranty",
    "category": "domain_specific",
    "domain": "ecommerce",
    "examples": [
      "Apple warranty check",
      "extended warranty worth it",
      "warranty claim Samsung"
    ],
    "pattern": "(.+?)\\s+warranty\\s*(.+)?",
    "template": {
      "like": "${1} warranty ${2}",
      "where": {
        "domain": "ecommerce",
        "type": "warranty"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "financial_stock_price",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "AAPL stock price",
      "Tesla share price",
      "GOOGL quote"
    ],
    "pattern": "([A-Z]{1,5})\\s+(?:stock\\s+)?(?:price|quote|shares?)",
    "template": {
      "like": "${1} stock price",
      "where": {
        "domain": "financial",
        "type": "stock",
        "ticker": "${1}"
      }
    },
    "confidence": 0.95,
    "frequency": "high"
  },
  {
    "id": "financial_calculator",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "mortgage calculator",
      "loan payment calculator",
      "retirement calculator"
    ],
    "pattern": "(.+?)\\s+calculator",
    "template": {
      "like": "${1} calculator",
      "where": {
        "domain": "financial",
        "type": "calculator"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "financial_interest_rates",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "mortgage interest rates",
      "CD rates today",
      "Fed interest rate"
    ],
    "pattern": "(.+?)\\s+(?:interest\\s+)?rates?\\s*(?:today|current)?",
    "template": {
      "like": "${1} interest rates",
      "where": {
        "domain": "financial",
        "type": "rates"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "financial_credit_score",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "credit score for mortgage",
      "improve credit score",
      "free credit report"
    ],
    "pattern": "(?:credit\\s+score|credit\\s+report)\\s+(?:for\\s+)?(.+)?",
    "template": {
      "like": "credit score ${1}",
      "where": {
        "domain": "financial",
        "type": "credit"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "financial_tax",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "tax deductions for homeowners",
      "capital gains tax rate",
      "tax brackets 2024"
    ],
    "pattern": "tax\\s+(.+?)\\s+(?:for\\s+(.+)|rate|brackets?)",
    "template": {
      "like": "tax ${1} ${2}",
      "where": {
        "domain": "financial",
        "type": "tax"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "financial_crypto",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "Bitcoin price",
      "Ethereum forecast",
      "buy cryptocurrency"
    ],
    "pattern": "(.+?)\\s+(?:price|forecast|buy|sell)",
    "template": {
      "like": "${1} cryptocurrency",
      "where": {
        "domain": "financial",
        "type": "crypto"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "financial_investment_strategy",
    "category": "domain_specific",
    "domain": "financial",
    "examples": [
      "401k investment strategy",
      "best ETFs 2024",
      "dividend investing"
    ],
    "pattern": "(.+?)\\s+(?:investment\\s+strategy|investing)",
    "template": {
      "like": "${1} investment strategy",
      "where": {
        "domain": "financial",
        "type": "investment"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "legal_statute_limitations",
    "category": "domain_specific",
    "domain": "legal",
    "examples": [
      "statute of limitations personal injury",
      "SOL for debt collection"
    ],
    "pattern": "statute\\s+of\\s+limitations?\\s+(?:for\\s+)?(.+)",
    "template": {
      "like": "${1} statute of limitations",
      "where": {
        "domain": "legal",
        "type": "statute"
      }
    },
    "confidence": 0.93,
    "frequency": "medium"
  },
  {
    "id": "legal_lawyer_type",
    "category": "domain_specific",
    "domain": "legal",
    "examples": [
      "divorce lawyer near me",
      "personal injury attorney",
      "criminal defense lawyer"
    ],
    "pattern": "(.+?)\\s+(?:lawyer|attorney)\\s*(?:near\\s+me)?",
    "template": {
      "like": "${1} lawyer",
      "where": {
        "domain": "legal",
        "type": "attorney"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "legal_how_to_file",
    "category": "domain_specific",
    "domain": "legal",
    "examples": [
      "how to file bankruptcy",
      "file for divorce",
      "file a complaint"
    ],
    "pattern": "(?:how\\s+to\\s+)?file\\s+(?:for\\s+)?(.+)",
    "template": {
      "like": "file ${1} procedure",
      "where": {
        "domain": "legal",
        "type": "filing"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "legal_jurisdiction",
    "category": "domain_specific",
    "domain": "legal",
    "examples": [
      "marijuana laws in California",
      "gun laws by state",
      "divorce laws in Texas"
    ],
    "pattern": "(.+?)\\s+laws?\\s+(?:in|by)\\s+(.+)",
    "template": {
      "like": "${1} laws ${2}",
      "where": {
        "domain": "legal",
        "jurisdiction": "${2}"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "legal_contract_template",
    "category": "domain_specific",
    "domain": "legal",
    "examples": [
      "rental agreement template",
      "NDA template",
      "employment contract sample"
    ],
    "pattern": "(.+?)\\s+(?:template|sample|form)",
    "template": {
      "like": "${1} template",
      "where": {
        "domain": "legal",
        "type": "template"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "legal_definition",
    "category": "domain_specific",
    "domain": "legal",
    "examples": [
      "tort law definition",
      "what is habeas corpus",
      "felony vs misdemeanor"
    ],
    "pattern": "(?:what\\s+is\\s+)?(.+?)\\s+(?:definition|meaning|vs\\.?\\s+(.+))",
    "template": {
      "like": "${1} ${2} legal definition",
      "where": {
        "domain": "legal",
        "type": "definition"
      }
    },
    "confidence": 0.9,
    "frequency": "high"
  },
  {
    "id": "medical_symptoms",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "symptoms of COVID",
      "symptoms of diabetes",
      "signs of heart attack"
    ],
    "pattern": "(?:symptoms?|signs?)\\s+(?:of|for)\\s+(.+)",
    "template": {
      "like": "${1} symptoms",
      "where": {
        "domain": "medical",
        "type": "symptoms"
      }
    },
    "confidence": 0.95,
    "frequency": "high"
  },
  {
    "id": "medical_side_effects",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "aspirin side effects",
      "vaccine side effects",
      "metformin side effects"
    ],
    "pattern": "(.+?)\\s+side\\s+effects?",
    "template": {
      "like": "${1} side effects",
      "where": {
        "domain": "medical",
        "type": "medication"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "medical_treatment",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "treatment for depression",
      "cure for cancer",
      "therapy for anxiety"
    ],
    "pattern": "(?:treatment|cure|therapy|remedy)\\s+(?:for|of)\\s+(.+)",
    "template": {
      "like": "${1} treatment",
      "where": {
        "domain": "medical",
        "type": "treatment"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "medical_pain",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "chest pain causes",
      "back pain relief",
      "headache remedies"
    ],
    "pattern": "(.+?)\\s+pain\\s+(?:causes?|relief|remedies?)",
    "template": {
      "like": "${1} pain",
      "where": {
        "domain": "medical",
        "type": "pain"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "medical_vaccine",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "COVID vaccine side effects",
      "flu shot effectiveness",
      "vaccine schedule babies"
    ],
    "pattern": "(.+?)\\s+vaccine\\s+(.+)",
    "template": {
      "like": "${1} vaccine ${2}",
      "where": {
        "domain": "medical",
        "type": "vaccine"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "medical_test_results",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "blood test results",
      "MRI results meaning",
      "normal cholesterol levels"
    ],
    "pattern": "(?:(.+?)\\s+)?(?:test\\s+)?results?\\s+(?:meaning|interpretation|normal\\s+range)",
    "template": {
      "like": "${1} test results",
      "where": {
        "domain": "medical",
        "type": "diagnostic"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "medical_doctor_specialist",
    "category": "domain_specific",
    "domain": "medical",
    "examples": [
      "cardiologist near me",
      "best dermatologist",
      "pediatrician reviews"
    ],
    "pattern": "(.+?(?:ologist|ician|doctor))\\s+(?:near\\s+me|reviews?|best)",
    "template": {
      "like": "${1}",
      "where": {
        "domain": "medical",
        "type": "specialist"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "prog_error_message",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "TypeError cannot read property",
      "undefined is not a function",
      "NullPointerException Java"
    ],
    "pattern": "([A-Za-z]+Error|[A-Za-z]+Exception)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "programming",
        "type": "error"
      }
    },
    "confidence": 0.96,
    "frequency": "very_high"
  },
  {
    "id": "prog_how_to_code",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "how to reverse string Python",
      "sort array JavaScript",
      "read file in Java"
    ],
    "pattern": "(?:how\\s+to\\s+)?(.+?)\\s+(?:in|using)\\s+(Python|JavaScript|Java|C\\+\\+|TypeScript|Go|Rust|Ruby|PHP|Swift|Kotlin|C#)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "programming",
        "language": "${2}"
      }
    },
    "confidence": 0.95,
    "frequency": "very_high"
  },
  {
    "id": "prog_git_commands",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "git merge conflict",
      "git rebase vs merge",
      "git undo commit"
    ],
    "pattern": "git\\s+(.+)",
    "template": {
      "like": "git ${1}",
      "where": {
        "domain": "programming",
        "type": "version_control"
      }
    },
    "confidence": 0.95,
    "frequency": "very_high"
  },
  {
    "id": "prog_stackoverflow_pattern",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "undefined is not a function JavaScript",
      "cannot read property of undefined React"
    ],
    "pattern": "(.+?)\\s+(JavaScript|Python|Java|C\\+\\+|React|Angular|Vue)$",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "programming",
        "source": "stackoverflow"
      }
    },
    "confidence": 0.95,
    "frequency": "very_high"
  },
  {
    "id": "prog_install_package",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "npm install react",
      "pip install tensorflow",
      "cargo add tokio"
    ],
    "pattern": "(?:npm|pip|yarn|cargo|gem|composer|go get|brew|apt|yum)\\s+(?:install|add|get)\\s+(.+)",
    "template": {
      "like": "install ${1}",
      "where": {
        "domain": "programming",
        "type": "package_install"
      }
    },
    "confidence": 0.94,
    "frequency": "very_high"
  },
  {
    "id": "prog_framework_tutorial",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "React tutorial",
      "Django getting started",
      "Spring Boot guide"
    ],
    "pattern": "(React|Vue|Angular|Django|Flask|Spring|Express|Rails|Laravel|Next\\.js|Nuxt|FastAPI)\\s+(?:tutorial|guide|getting\\s+started)",
    "template": {
      "like": "${1} tutorial",
      "where": {
        "domain": "programming",
        "framework": "${1}"
      }
    },
    "confidence": 0.94,
    "frequency": "very_high"
  },
  {
    "id": "prog_debug_issue",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "debug React hooks",
      "memory leak Java",
      "segmentation fault C++"
    ],
    "pattern": "(?:debug|fix|solve|troubleshoot)\\s+(.+?)\\s*(?:issue|problem|error|bug)?",
    "template": {
      "like": "debug ${1}",
      "where": {
        "domain": "programming",
        "type": "debugging"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "prog_api_docs",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "OpenAI API documentation",
      "Stripe API reference",
      "REST API example"
    ],
    "pattern": "(.+?)\\s+API\\s+(?:documentation|reference|example|tutorial)",
    "template": {
      "like": "${1} API documentation",
      "where": {
        "domain": "programming",
        "type": "api"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "prog_import_module",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "import React from react",
      "from sklearn import",
      "require module Node.js"
    ],
    "pattern": "(?:import|from|require|use|include)\\s+(.+?)\\s+(?:from|in)?\\s*(.+)?",
    "template": {
      "like": "import ${1} ${2}",
      "where": {
        "domain": "programming",
        "type": "import"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "prog_algorithm",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "quicksort algorithm",
      "binary search implementation",
      "Dijkstra's algorithm"
    ],
    "pattern": "(.+?)\\s+(?:algorithm|implementation)\\s*(?:in\\s+(.+))?",
    "template": {
      "like": "${1} algorithm ${2}",
      "where": {
        "domain": "programming",
        "type": "algorithm"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "prog_best_practices",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "React best practices",
      "Python coding standards",
      "clean code JavaScript"
    ],
    "pattern": "(.+?)\\s+(?:best\\s+practices?|coding\\s+standards?|clean\\s+code|style\\s+guide)",
    "template": {
      "like": "${1} best practices",
      "where": {
        "domain": "programming",
        "type": "best_practices"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "prog_regex_pattern",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "regex email validation",
      "regular expression phone number",
      "regex match URL"
    ],
    "pattern": "(?:regex|regular\\s+expression)\\s+(?:for\\s+)?(.+)",
    "template": {
      "like": "regex ${1}",
      "where": {
        "domain": "programming",
        "type": "regex"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "prog_convert_code",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "convert Python to JavaScript",
      "JSON to XML",
      "SQL to MongoDB"
    ],
    "pattern": "(?:convert|translate|transform)\\s+(.+?)\\s+to\\s+(.+)",
    "template": {
      "like": "convert ${1} to ${2}",
      "where": {
        "domain": "programming",
        "type": "conversion"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "prog_data_structure",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "linked list vs array",
      "implement stack Python",
      "binary tree traversal"
    ],
    "pattern": "(?:implement\\s+)?(.+?)\\s*(?:data\\s+structure|vs\\.?\\s+(.+))?\\s*(?:in\\s+(.+))?",
    "template": {
      "like": "${1} data structure ${2} ${3}",
      "where": {
        "domain": "programming",
        "type": "data_structure"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "prog_vscode_extension",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "VSCode extension Python",
      "best VSCode themes",
      "VSCode shortcuts"
    ],
    "pattern": "(?:VSCode|VS\\s+Code)\\s+(.+)",
    "template": {
      "like": "VSCode ${1}",
      "where": {
        "domain": "programming",
        "type": "ide"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "prog_package_version",
    "category": "domain_specific",
    "domain": "programming",
    "examples": [
      "React 18 features",
      "Python 3.11 new",
      "Node.js version 20"
    ],
    "pattern": "(.+?)\\s+(?:version\\s+)?(\\d+(?:\\.\\d+)*)\\s*(.+)?",
    "template": {
      "like": "${1} ${2} ${3}",
      "where": {
        "domain": "programming",
        "version": "${2}"
      }
    },
    "confidence": 0.9,
    "frequency": "high"
  },
  {
    "id": "social_trending",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "trending on Twitter",
      "viral TikTok videos",
      "Instagram trends 2024"
    ],
    "pattern": "(?:trending|viral|popular)\\s+(?:on\\s+)?(Twitter|TikTok|Instagram|YouTube|LinkedIn|Reddit|Facebook)\\s*(.+)?",
    "template": {
      "like": "${1} trending ${2}",
      "where": {
        "domain": "social",
        "platform": "${1}",
        "type": "trending"
      }
    },
    "confidence": 0.94,
    "frequency": "very_high"
  },
  {
    "id": "social_algorithm",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram algorithm 2024",
      "TikTok algorithm explained",
      "YouTube algorithm changes"
    ],
    "pattern": "(Instagram|TikTok|YouTube|Twitter|LinkedIn)\\s+algorithm\\s*(.+)?",
    "template": {
      "like": "${1} algorithm ${2}",
      "where": {
        "domain": "social",
        "platform": "${1}",
        "type": "algorithm"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "social_followers",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "how to get more followers",
      "increase Instagram followers",
      "buy Twitter followers"
    ],
    "pattern": "(?:how\\s+to\\s+)?(?:get|gain|increase|buy)\\s+(?:more\\s+)?(.+?)\\s+followers?",
    "template": {
      "like": "${1} followers growth",
      "where": {
        "domain": "social",
        "type": "growth"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "social_monetization",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "monetize Instagram",
      "YouTube earnings calculator",
      "TikTok creator fund"
    ],
    "pattern": "(?:monetize|earn\\s+money|creator\\s+fund)\\s+(?:on\\s+)?(.+)",
    "template": {
      "like": "monetize ${1}",
      "where": {
        "domain": "social",
        "type": "monetization"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "social_hashtag",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "#AI hashtag",
      "best hashtags for Instagram",
      "trending hashtags today"
    ],
    "pattern": "(?:#(\\w+)|hashtags?\\s+(?:for\\s+)?(.+))",
    "template": {
      "like": "hashtag ${1}${2}",
      "where": {
        "domain": "social",
        "type": "hashtag"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "social_content_ideas",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram post ideas",
      "TikTok video ideas",
      "LinkedIn content strategy"
    ],
    "pattern": "(.+?)\\s+(?:post|video|content|story)\\s+(?:ideas?|strategy|tips?)",
    "template": {
      "like": "${1} content ideas",
      "where": {
        "domain": "social",
        "type": "content_strategy"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "social_caption",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram caption ideas",
      "funny captions",
      "caption for selfie"
    ],
    "pattern": "(.+?)\\s*(?:captions?|quotes?)\\s+(?:for\\s+)?(.+)?",
    "template": {
      "like": "${1} caption ${2}",
      "where": {
        "domain": "social",
        "type": "caption"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "social_verification",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "get verified on Instagram",
      "Twitter blue checkmark",
      "verification requirements"
    ],
    "pattern": "(?:get\\s+)?verifi(?:ed|cation)\\s+(?:on\\s+)?(.+)",
    "template": {
      "like": "${1} verification",
      "where": {
        "domain": "social",
        "type": "verification"
      }
    },
    "confidence": 0.92,
    "frequency": "medium"
  },
  {
    "id": "social_influencer",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "top tech influencers",
      "Instagram influencers fashion",
      "YouTube creators gaming"
    ],
    "pattern": "(?:top\\s+)?(.+?)\\s+(?:influencers?|creators?|YouTubers?)\\s*(?:on\\s+(.+))?",
    "template": {
      "like": "${1} influencers ${2}",
      "where": {
        "domain": "social",
        "type": "influencer"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "social_analytics",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram analytics tools",
      "track Twitter engagement",
      "social media metrics"
    ],
    "pattern": "(.+?)\\s+(?:analytics?|metrics?|insights?|engagement)\\s*(?:tools?)?",
    "template": {
      "like": "${1} analytics",
      "where": {
        "domain": "social",
        "type": "analytics"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "social_bio_profile",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram bio ideas",
      "LinkedIn profile tips",
      "Twitter bio generator"
    ],
    "pattern": "(.+?)\\s+(?:bio|profile)\\s+(?:ideas?|tips?|generator|examples?)",
    "template": {
      "like": "${1} bio ideas",
      "where": {
        "domain": "social",
        "type": "profile"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "social_story_reel",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram story ideas",
      "how to make reels",
      "TikTok vs Reels"
    ],
    "pattern": "(?:Instagram\\s+)?(?:story|stories|reels?)\\s+(.+)",
    "template": {
      "like": "story reels ${1}",
      "where": {
        "domain": "social",
        "type": "stories"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "social_privacy_settings",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram privacy settings",
      "make Twitter private",
      "Facebook privacy"
    ],
    "pattern": "(.+?)\\s+privacy\\s*(?:settings?)?",
    "template": {
      "like": "${1} privacy",
      "where": {
        "domain": "social",
        "type": "privacy"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "social_scheduling",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "best time to post Instagram",
      "schedule tweets",
      "social media calendar"
    ],
    "pattern": "(?:best\\s+time\\s+to\\s+post|schedule)\\s+(.+)",
    "template": {
      "like": "${1} posting schedule",
      "where": {
        "domain": "social",
        "type": "scheduling"
      }
    },
    "confidence": 0.9,
    "frequency": "high"
  },
  {
    "id": "social_collaboration",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram collaboration",
      "brand partnerships",
      "influencer marketing"
    ],
    "pattern": "(?:brand\\s+)?(?:collaboration|partnership|sponsorship)\\s+(.+)",
    "template": {
      "like": "${1} collaboration",
      "where": {
        "domain": "social",
        "type": "collaboration"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "social_live_streaming",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram live tips",
      "YouTube streaming setup",
      "Twitch vs YouTube"
    ],
    "pattern": "(.+?)\\s+(?:live|streaming|stream)\\s*(.+)?",
    "template": {
      "like": "${1} live streaming ${2}",
      "where": {
        "domain": "social",
        "type": "streaming"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "social_username",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "username ideas aesthetic",
      "check username availability",
      "Instagram username generator"
    ],
    "pattern": "(?:username|handle)\\s+(.+)",
    "template": {
      "like": "username ${1}",
      "where": {
        "domain": "social",
        "type": "username"
      }
    },
    "confidence": 0.89,
    "frequency": "medium"
  },
  {
    "id": "social_dm_messaging",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram DM not working",
      "Twitter DM limits",
      "LinkedIn message templates"
    ],
    "pattern": "(.+?)\\s+(?:DM|direct\\s+message|messaging)\\s*(.+)?",
    "template": {
      "like": "${1} messaging ${2}",
      "where": {
        "domain": "social",
        "type": "messaging"
      }
    },
    "confidence": 0.89,
    "frequency": "medium"
  },
  {
    "id": "social_meme_viral",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "trending memes",
      "meme generator",
      "viral video ideas"
    ],
    "pattern": "(?:trending\\s+)?(?:memes?|viral\\s+videos?)\\s*(.+)?",
    "template": {
      "like": "memes viral ${1}",
      "where": {
        "domain": "social",
        "type": "meme"
      }
    },
    "confidence": 0.89,
    "frequency": "high"
  },
  {
    "id": "social_filters_effects",
    "category": "domain_specific",
    "domain": "social",
    "examples": [
      "Instagram filters",
      "TikTok effects",
      "Snapchat lenses"
    ],
    "pattern": "(.+?)\\s+(?:filters?|effects?|lenses?)\\s*(.+)?",
    "template": {
      "like": "${1} filters ${2}",
      "where": {
        "domain": "social",
        "type": "filters"
      }
    },
    "confidence": 0.88,
    "frequency": "medium"
  },
  {
    "id": "tech_database_query",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "SQL join example",
      "MongoDB aggregation",
      "PostgreSQL vs MySQL"
    ],
    "pattern": "(SQL|MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch|Cassandra)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "database"
      }
    },
    "confidence": 0.94,
    "frequency": "very_high"
  },
  {
    "id": "tech_cloud_service",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "AWS S3 tutorial",
      "Google Cloud pricing",
      "Azure vs AWS"
    ],
    "pattern": "(AWS|Azure|GCP|Google\\s+Cloud|Heroku|DigitalOcean|Vercel|Netlify)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "cloud"
      }
    },
    "confidence": 0.93,
    "frequency": "very_high"
  },
  {
    "id": "tech_security",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "SQL injection prevention",
      "XSS attack",
      "JWT authentication"
    ],
    "pattern": "(SQL\\s+injection|XSS|CSRF|JWT|OAuth|authentication|authorization)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "security"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "tech_docker_kubernetes",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "Docker compose example",
      "Kubernetes deployment",
      "dockerfile for Node.js"
    ],
    "pattern": "(Docker|Kubernetes|K8s|container|dockerfile|docker-compose)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "containerization"
      }
    },
    "confidence": 0.92,
    "frequency": "very_high"
  },
  {
    "id": "tech_performance",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "optimize React performance",
      "database indexing",
      "lazy loading implementation"
    ],
    "pattern": "(?:optimize|improve)\\s+(.+?)\\s+performance",
    "template": {
      "like": "${1} performance optimization",
      "where": {
        "domain": "tech",
        "type": "performance"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "tech_web_framework",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "Next.js vs Gatsby",
      "Tailwind CSS tutorial",
      "Bootstrap components"
    ],
    "pattern": "(Next\\.js|Gatsby|Tailwind|Bootstrap|Material-UI|Chakra|Ant\\s+Design)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "web_framework"
      }
    },
    "confidence": 0.92,
    "frequency": "very_high"
  },
  {
    "id": "tech_cli_commands",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "curl POST request",
      "wget download file",
      "ssh key generation"
    ],
    "pattern": "(curl|wget|ssh|scp|rsync|grep|sed|awk|chmod|chown)\\s+(.+)",
    "template": {
      "like": "${1} command ${2}",
      "where": {
        "domain": "tech",
        "type": "cli"
      }
    },
    "confidence": 0.92,
    "frequency": "very_high"
  },
  {
    "id": "tech_devops_ci_cd",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "GitHub Actions workflow",
      "Jenkins pipeline",
      "CI/CD best practices"
    ],
    "pattern": "(GitHub\\s+Actions|Jenkins|CircleCI|Travis|GitLab\\s+CI|CI/CD)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "devops"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "tech_testing",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "unit testing Jest",
      "integration testing",
      "mock API calls"
    ],
    "pattern": "(unit\\s+test|integration\\s+test|e2e\\s+test|mock|stub)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "testing"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "tech_mobile_dev",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "React Native navigation",
      "Flutter vs React Native",
      "SwiftUI tutorial"
    ],
    "pattern": "(React\\s+Native|Flutter|SwiftUI|Kotlin|Swift|Android|iOS)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "mobile"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "tech_linux_admin",
    "category": "domain_specific",
    "domain": "tech",
    "examples": [
      "Ubuntu install package",
      "systemd service",
      "cron job example"
    ],
    "pattern": "(Ubuntu|Debian|CentOS|Linux|systemd|cron|iptables|nginx|apache)\\s+(.+)",
    "template": {
      "like": "${1} ${2}",
      "where": {
        "domain": "tech",
        "type": "sysadmin"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "technical_error_fix",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "error 404 fix",
      "blue screen of death",
      "kernel panic solution"
    ],
    "pattern": "(?:error\\s+)?(.+?)\\s+(?:fix|solution|resolve)",
    "template": {
      "like": "${1} fix",
      "where": {
        "domain": "technical",
        "type": "troubleshooting"
      }
    },
    "confidence": 0.94,
    "frequency": "high"
  },
  {
    "id": "technical_not_working",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "WiFi not working",
      "printer not responding",
      "app won't open"
    ],
    "pattern": "(.+?)\\s+(?:not\\s+working|won't\\s+(?:open|start|load)|not\\s+responding)",
    "template": {
      "like": "${1} troubleshooting",
      "where": {
        "domain": "technical",
        "type": "issue"
      }
    },
    "confidence": 0.93,
    "frequency": "high"
  },
  {
    "id": "technical_driver_download",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "NVIDIA driver download",
      "printer driver HP",
      "Realtek audio driver"
    ],
    "pattern": "(.+?)\\s+driver\\s*(?:download)?",
    "template": {
      "like": "${1} driver",
      "where": {
        "domain": "technical",
        "type": "driver"
      }
    },
    "confidence": 0.93,
    "frequency": "medium"
  },
  {
    "id": "technical_how_to_reset",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "reset iPhone",
      "factory reset laptop",
      "reset password Windows"
    ],
    "pattern": "(?:how\\s+to\\s+)?(?:reset|factory\\s+reset)\\s+(.+)",
    "template": {
      "like": "reset ${1}",
      "where": {
        "domain": "technical",
        "type": "reset"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "technical_backup_restore",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "backup iPhone",
      "restore from backup",
      "cloud backup options"
    ],
    "pattern": "(?:backup|restore)\\s+(?:from\\s+)?(.+)",
    "template": {
      "like": "${1} backup",
      "where": {
        "domain": "technical",
        "type": "backup"
      }
    },
    "confidence": 0.92,
    "frequency": "high"
  },
  {
    "id": "technical_update",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "update Windows 11",
      "iOS 17 update",
      "Chrome latest version"
    ],
    "pattern": "(?:update|upgrade)\\s+(.+?)\\s*(?:to\\s+(.+))?",
    "template": {
      "like": "${1} update ${2}",
      "where": {
        "domain": "technical",
        "type": "update"
      }
    },
    "confidence": 0.91,
    "frequency": "high"
  },
  {
    "id": "technical_compatibility",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "compatible with Windows 11",
      "works with Mac",
      "supports Android"
    ],
    "pattern": "(?:compatible\\s+with|works\\s+with|supports?)\\s+(.+)",
    "template": {
      "like": "${1} compatibility",
      "where": {
        "domain": "technical",
        "type": "compatibility"
      }
    },
    "confidence": 0.91,
    "frequency": "medium"
  },
  {
    "id": "technical_speed_up",
    "category": "domain_specific",
    "domain": "technical",
    "examples": [
      "speed up computer",
      "make phone faster",
      "optimize Windows"
    ],
    "pattern": "(?:speed\\s+up|make\\s+(.+?)\\s+faster|optimize)\\s+(.+)",
    "template": {
      "like": "${1}${2} optimization",
      "where": {
        "domain": "technical",
        "type": "performance"
      }
    },
    "confidence": 0.9,
    "frequency": "medium"
  },
  {
    "id": "is_there_any",
    "category": "existence",
    "examples": [
      "is there any research on",
      "are there any papers about"
    ],
    "pattern": "(?:is|are)\\s+there\\s+(?:any\\s+)?(.+?)\\s+(?:on|about|for)\\s+(.+)",
    "template": {
      "like": "${2} ${1}"
    },
    "confidence": 0.83
  },
  {
    "id": "filter_more_than",
    "category": "filtering",
    "examples": [
      "papers with more than 100 citations",
      "models with over 1B parameters"
    ],
    "pattern": "(.+) with (more than|over|greater than) (\\d+) (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${4}": {
          "greaterThan": "${3}"
        }
      }
    },
    "confidence": 0.9
  },
  {
    "id": "filter_less_than",
    "category": "filtering",
    "examples": [
      "models with less than 1M parameters",
      "papers with under 10 citations"
    ],
    "pattern": "(.+) with (less than|under|fewer than) (\\d+) (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${4}": {
          "lessThan": "${3}"
        }
      }
    },
    "confidence": 0.9
  },
  {
    "id": "all_that_have",
    "category": "filtering",
    "examples": [
      "all papers that have citations",
      "all documents that contain"
    ],
    "pattern": "all\\s+(.+?)\\s+that\\s+(?:have|contain|include)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${2}": {
          "exists": true
        }
      }
    },
    "confidence": 0.86
  },
  {
    "id": "filter_with",
    "category": "filtering",
    "examples": [
      "papers with code",
      "models with pretrained weights",
      "datasets with labels"
    ],
    "pattern": "(.+) with (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${2}": {
          "exists": true
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "filter_without",
    "category": "filtering",
    "examples": [
      "papers without code",
      "models without training",
      "datasets without labels"
    ],
    "pattern": "(.+) without (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${2}": {
          "exists": false
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "filter_except",
    "category": "filtering",
    "examples": [
      "all models except GPT",
      "papers except reviews",
      "everything but tutorials"
    ],
    "pattern": "(.+) (except|but not|excluding) (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "notLike": "${3}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "filter_including",
    "category": "filtering",
    "examples": [
      "papers including code",
      "models including documentation"
    ],
    "pattern": "(.+) (including|with|containing) (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "includes": "${3}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "filter_exactly",
    "category": "filtering",
    "examples": [
      "papers with exactly 5 authors",
      "models with 12 layers"
    ],
    "pattern": "(.+) with (exactly |)(\\d+) (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${4}": "${3}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "with_without",
    "category": "filtering",
    "examples": [
      "papers with citations",
      "results without errors",
      "documents with images"
    ],
    "pattern": "(.+?)\\s+(with|without)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "${3}": {
          "exists": true
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "starting_with",
    "category": "filtering",
    "examples": [
      "starting with A",
      "beginning with chapter",
      "ending with PDF"
    ],
    "pattern": "(.+?)\\s+(?:starting|beginning|ending)\\s+with\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "pattern": "${2}"
      }
    },
    "confidence": 0.84
  },
  {
    "id": "filter_only",
    "category": "filtering",
    "examples": [
      "only open source models",
      "only free datasets",
      "papers only"
    ],
    "pattern": "(only )? (.+) (only)?",
    "template": {
      "like": "${2}",
      "where": {
        "exclusive": true
      }
    },
    "confidence": 0.75
  },
  {
    "id": "documentation_for",
    "category": "informational",
    "examples": [
      "documentation for React",
      "docs on Python",
      "API reference"
    ],
    "pattern": "(?:documentation|docs|reference|manual)\\s+(?:for|on|about)?\\s*(.+)",
    "template": {
      "like": "${1} documentation",
      "where": {
        "type": "documentation"
      }
    },
    "confidence": 0.93
  },
  {
    "id": "tutorial_howto",
    "category": "informational",
    "examples": [
      "tutorial on machine learning",
      "guide to Python",
      "how to use React"
    ],
    "pattern": "(?:tutorial|guide|how\\s+to\\s+use)\\s+(?:on|to|for)?\\s*(.+)",
    "template": {
      "like": "${1} tutorial",
      "boost": "educational"
    },
    "confidence": 0.92
  },
  {
    "id": "getting_started",
    "category": "informational",
    "examples": [
      "getting started with React",
      "introduction to Python",
      "beginner guide"
    ],
    "pattern": "(?:getting\\s+started|introduction|beginner'?s?\\s+guide)\\s+(?:with|to|for)?\\s*(.+)",
    "template": {
      "like": "${1} beginner",
      "boost": "educational"
    },
    "confidence": 0.92
  },
  {
    "id": "definition_of",
    "category": "informational",
    "examples": [
      "definition of AI",
      "what does ML mean",
      "meaning of neural network"
    ],
    "pattern": "(?:definition\\s+of|what\\s+does\\s+(.+?)\\s+mean|meaning\\s+of)\\s*(.+)",
    "template": {
      "like": "${1}${2} definition",
      "boost": "educational"
    },
    "confidence": 0.91
  },
  {
    "id": "cheat_sheet",
    "category": "informational",
    "examples": [
      "cheat sheet for Python",
      "quick reference",
      "cheatsheet React"
    ],
    "pattern": "(?:cheat\\s*sheet|quick\\s+reference|reference\\s+card)\\s+(?:for)?\\s*(.+)",
    "template": {
      "like": "${1} cheatsheet",
      "boost": "educational"
    },
    "confidence": 0.91
  },
  {
    "id": "info_what",
    "category": "informational",
    "examples": [
      "what is machine learning",
      "what are neural networks",
      "what does AI mean"
    ],
    "pattern": "what (is|are|does) (.+)",
    "template": {
      "like": "${2}"
    },
    "confidence": 0.9
  },
  {
    "id": "info_definition",
    "category": "informational",
    "examples": [
      "machine learning definition",
      "AI meaning",
      "what neural network means"
    ],
    "pattern": "(.+) (definition|meaning|means)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "definition"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "info_explain",
    "category": "informational",
    "examples": [
      "explain backpropagation",
      "explain how transformers work"
    ],
    "pattern": "explain (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "explanation"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "info_tutorial",
    "category": "informational",
    "examples": [
      "tutorial on deep learning",
      "pytorch tutorial",
      "guide to NLP"
    ],
    "pattern": "(tutorial|guide|course) (on|to|for)? (.+)",
    "template": {
      "like": "${3}",
      "where": {
        "type": "tutorial"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "step_by_step",
    "category": "informational",
    "examples": [
      "step by step guide",
      "walkthrough",
      "detailed instructions"
    ],
    "pattern": "(?:step\\s+by\\s+step|walkthrough|detailed\\s+instructions)\\s+(?:for|on)?\\s*(.+)",
    "template": {
      "like": "${1} tutorial detailed",
      "boost": "educational"
    },
    "confidence": 0.9
  },
  {
    "id": "tell_me_about",
    "category": "informational",
    "examples": [
      "tell me about machine learning",
      "explain neural networks"
    ],
    "pattern": "(?:tell\\s+me\\s+about|explain|describe)\\s+(.+)",
    "template": {
      "like": "${1}",
      "boost": "educational"
    },
    "confidence": 0.88
  },
  {
    "id": "use_cases",
    "category": "informational",
    "examples": [
      "use cases for blockchain",
      "applications of AI",
      "when to use React"
    ],
    "pattern": "(?:use\\s+cases?|applications?|when\\s+to\\s+use)\\s+(?:for|of)?\\s*(.+)",
    "template": {
      "like": "${1} applications",
      "boost": "practical"
    },
    "confidence": 0.88
  },
  {
    "id": "advanced_expert",
    "category": "informational",
    "examples": [
      "advanced Python techniques",
      "expert guide",
      "pro tips for"
    ],
    "pattern": "(?:advanced|expert|pro\\s+tips?)\\s+(?:techniques?|guide)?\\s*(?:for|on)?\\s*(.+)",
    "template": {
      "like": "${1} advanced",
      "boost": "expert"
    },
    "confidence": 0.87
  },
  {
    "id": "example_of",
    "category": "informational",
    "examples": [
      "example of machine learning",
      "sample code",
      "demo application"
    ],
    "pattern": "(?:example|sample|demo)\\s+(?:of|for)?\\s*(.+)",
    "template": {
      "like": "${1} example",
      "boost": "educational"
    },
    "confidence": 0.86
  },
  {
    "id": "info_how",
    "category": "informational",
    "examples": [
      "how to train a model",
      "how does clustering work",
      "how to implement search"
    ],
    "pattern": "how (to|does|do|can) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "tutorial"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "info_why",
    "category": "informational",
    "examples": [
      "why use vector databases",
      "why does overfitting occur"
    ],
    "pattern": "why (does|do|is|are|use) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "explanation"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "info_when",
    "category": "informational",
    "examples": [
      "when did deep learning start",
      "when was transformer invented"
    ],
    "pattern": "when (did|was|were|is|are) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "event"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "info_where",
    "category": "informational",
    "examples": [
      "where is Stanford located",
      "where can I find datasets"
    ],
    "pattern": "where (is|are|can|do) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "location"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "info_who",
    "category": "informational",
    "examples": [
      "who invented transformers",
      "who is Geoffrey Hinton"
    ],
    "pattern": "who (is|are|invented|created|made) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "person"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "question_can",
    "category": "informational",
    "examples": [
      "can transformers handle images",
      "can I use this for NLP"
    ],
    "pattern": "can (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "type": "capability"
      }
    },
    "confidence": 0.8
  },
  {
    "id": "question_should",
    "category": "informational",
    "examples": [
      "should I use tensorflow",
      "should we implement caching"
    ],
    "pattern": "should (I|we|you) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "recommendation"
      }
    },
    "confidence": 0.8
  },
  {
    "id": "nav_entity",
    "category": "navigational",
    "examples": [
      "OpenAI website",
      "Google homepage",
      "GitHub tensorflow"
    ],
    "pattern": "([A-Z][\\w]+) (website|homepage|page|site)",
    "template": {
      "where": {
        "name": "${1}",
        "type": "website"
      }
    },
    "confidence": 0.95
  },
  {
    "id": "official_docs",
    "category": "navigational",
    "examples": [
      "official React documentation",
      "official Python site"
    ],
    "pattern": "official\\s+(.+?)\\s*(?:documentation|docs|site|website)?",
    "template": {
      "like": "${1} official",
      "where": {
        "official": true
      }
    },
    "confidence": 0.93
  },
  {
    "id": "action_find",
    "category": "navigational",
    "examples": [
      "find papers about AI",
      "search for models",
      "look for datasets"
    ],
    "pattern": "(find|search for|look for) (.+)",
    "template": {
      "like": "${2}"
    },
    "confidence": 0.9
  },
  {
    "id": "synonym_find",
    "category": "navigational",
    "examples": [
      "find machine learning papers",
      "locate AI research",
      "get neural network docs"
    ],
    "pattern": "(?:find|locate|get|fetch|retrieve)\\s+(.+)",
    "template": {
      "like": "${1}"
    },
    "confidence": 0.9
  },
  {
    "id": "synonym_show",
    "category": "navigational",
    "examples": [
      "show me recent papers",
      "display all results",
      "list available options"
    ],
    "pattern": "(?:show\\s+me|display|list|view)\\s+(.+)",
    "template": {
      "like": "${1}"
    },
    "confidence": 0.88
  },
  {
    "id": "nav_goto",
    "category": "navigational",
    "examples": [
      "go to documentation",
      "navigate to settings"
    ],
    "pattern": "(go to|navigate to|open|show) (.+)",
    "template": {
      "where": {
        "name": "${2}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "nav_profile",
    "category": "navigational",
    "examples": [
      "John Smith profile",
      "user profile",
      "my account"
    ],
    "pattern": "(.+) (profile|account|page)",
    "template": {
      "where": {
        "name": "${1}",
        "type": "profile"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "action_show",
    "category": "navigational",
    "examples": [
      "show me papers",
      "display results",
      "list models"
    ],
    "pattern": "(show|display|list) (me )? (.+)",
    "template": {
      "like": "${3}"
    },
    "confidence": 0.85
  },
  {
    "id": "community_forum",
    "category": "navigational",
    "examples": [
      "React community",
      "Python forum",
      "Discord server for"
    ],
    "pattern": "(?:community|forum|discord|slack|discussion)\\s+(?:for)?\\s*(.+)",
    "template": {
      "like": "${1} community",
      "where": {
        "type": "community"
      }
    },
    "confidence": 0.84
  },
  {
    "id": "relational_by_author",
    "category": "relational",
    "examples": [
      "papers by Hinton",
      "research by OpenAI",
      "models by Google"
    ],
    "pattern": "(.+) by ([A-Z][\\w\\s]+)",
    "template": {
      "like": "${1}",
      "connected": {
        "from": "${2}"
      }
    },
    "confidence": 0.95
  },
  {
    "id": "relational_authored",
    "category": "relational",
    "examples": [
      "papers authored by Bengio",
      "articles written by researchers"
    ],
    "pattern": "(.+) (authored|written) by (.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "from": "${3}",
        "type": "author"
      }
    },
    "confidence": 0.95
  },
  {
    "id": "who_created",
    "category": "relational",
    "examples": [
      "who created React",
      "who wrote this paper",
      "who invented the internet"
    ],
    "pattern": "who\\s+(?:created|wrote|invented|developed|made)\\s+(.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "relationship": "creator"
      }
    },
    "confidence": 0.92
  },
  {
    "id": "relational_from_source",
    "category": "relational",
    "examples": [
      "papers from Stanford",
      "datasets from Google",
      "models from OpenAI"
    ],
    "pattern": "(.+) from ([A-Z][\\w\\s]+)",
    "template": {
      "like": "${1}",
      "connected": {
        "from": "${2}"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "relational_created_by",
    "category": "relational",
    "examples": [
      "models created by OpenAI",
      "datasets created by Google"
    ],
    "pattern": "(.+) (created|made|developed|built) by (.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "from": "${3}",
        "type": "created"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "relational_published",
    "category": "relational",
    "examples": [
      "papers published by Nature",
      "articles published in Science"
    ],
    "pattern": "(.+) published (by|in) (.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "from": "${3}",
        "type": "publisher"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "similar_to",
    "category": "relational",
    "examples": [
      "similar to Python",
      "papers like this one",
      "alternatives to React"
    ],
    "pattern": "(?:similar\\s+to|like|alternatives?\\s+to)\\s+(.+)",
    "template": {
      "like": "${1}",
      "boost": "similarity"
    },
    "confidence": 0.87
  },
  {
    "id": "relational_related",
    "category": "relational",
    "examples": [
      "papers related to transformers",
      "research connected to NLP"
    ],
    "pattern": "(.+) (related to|connected to|associated with) (.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "to": "${3}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "based_on",
    "category": "relational",
    "examples": [
      "based on React",
      "built with Python",
      "powered by"
    ],
    "pattern": "(?:based\\s+on|built\\s+with|powered\\s+by|using)\\s+(.+)",
    "template": {
      "like": "${1}",
      "connected": {
        "technology": "${1}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "spatial_in",
    "category": "spatial",
    "examples": [
      "companies in Silicon Valley",
      "universities in Boston",
      "labs in California"
    ],
    "pattern": "(.+) in ([A-Z][\\w\\s]+)",
    "template": {
      "like": "${1}",
      "where": {
        "location": "${2}"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "spatial_near",
    "category": "spatial",
    "examples": [
      "conferences near Boston",
      "labs near Stanford",
      "companies near me"
    ],
    "pattern": "(.+) near (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "location": {
          "near": "${2}"
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "spatial_at",
    "category": "spatial",
    "examples": [
      "researchers at MIT",
      "papers at conference",
      "work at Google"
    ],
    "pattern": "(.+) at ([A-Z][\\w]+)",
    "template": {
      "like": "${1}",
      "where": {
        "organization": "${2}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "where_location",
    "category": "spatial",
    "examples": [
      "where is Stanford University",
      "where can I find documentation"
    ],
    "pattern": "where\\s+(?:is|are|can\\s+I\\s+find)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "location": {
          "exists": true
        }
      }
    },
    "confidence": 0.83
  },
  {
    "id": "version_specific",
    "category": "technical",
    "examples": [
      "React version 18",
      "Python 3.11",
      "Node.js v20"
    ],
    "pattern": "(.+?)\\s+version\\s+(\\d+(?:\\.\\d+)*)",
    "template": {
      "like": "${1}",
      "where": {
        "version": "${2}"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "api_endpoint",
    "category": "technical",
    "examples": [
      "API endpoint for users",
      "REST API documentation",
      "GraphQL schema"
    ],
    "pattern": "(?:API|REST|GraphQL)\\s+(?:endpoint|documentation|schema)\\s+(?:for)?\\s*(.+)",
    "template": {
      "like": "${1} API",
      "where": {
        "type": "api"
      }
    },
    "confidence": 0.89
  },
  {
    "id": "security_vulnerability",
    "category": "technical",
    "examples": [
      "security issues",
      "vulnerability in",
      "CVE for"
    ],
    "pattern": "(?:security|vulnerability|CVE)\\s+(?:issues?|in|for)?\\s*(.+)",
    "template": {
      "like": "${1} security",
      "where": {
        "type": "security"
      }
    },
    "confidence": 0.89
  },
  {
    "id": "source_code",
    "category": "technical",
    "examples": [
      "source code for React",
      "GitHub repository",
      "code examples"
    ],
    "pattern": "(?:source\\s+code|github|repository|code\\s+examples?)\\s+(?:for|of)?\\s*(.+)",
    "template": {
      "like": "${1} code",
      "where": {
        "type": "code"
      }
    },
    "confidence": 0.87
  },
  {
    "id": "troubleshoot_fix",
    "category": "technical",
    "examples": [
      "troubleshoot Python error",
      "fix React issue",
      "solve problem with"
    ],
    "pattern": "(?:troubleshoot|fix|solve|debug|resolve)\\s+(.+?)\\s*(?:error|issue|problem|bug)?",
    "template": {
      "like": "${1} solution",
      "where": {
        "type": "troubleshooting"
      }
    },
    "confidence": 0.87
  },
  {
    "id": "performance_optimization",
    "category": "technical",
    "examples": [
      "optimize React performance",
      "speed up Python",
      "improve efficiency"
    ],
    "pattern": "(?:optimize|speed\\s+up|improve\\s+efficiency)\\s+(?:of)?\\s*(.+?)\\s*(?:performance)?",
    "template": {
      "like": "${1} optimization",
      "boost": "performance"
    },
    "confidence": 0.87
  },
  {
    "id": "migration_upgrade",
    "category": "technical",
    "examples": [
      "migrate from React 17 to 18",
      "upgrade guide",
      "migration path"
    ],
    "pattern": "(?:migrate|upgrade|migration\\s+path)\\s+(?:from\\s+)?(.+?)\\s+(?:to\\s+(.+))?",
    "template": {
      "like": "${1} ${2} migration",
      "where": {
        "type": "migration"
      }
    },
    "confidence": 0.86
  },
  {
    "id": "integration_with",
    "category": "technical",
    "examples": [
      "integrate React with Redux",
      "connect Python to database"
    ],
    "pattern": "(?:integrate|connect|interface)\\s+(.+?)\\s+(?:with|to)\\s+(.+)",
    "template": {
      "like": "${1} ${2} integration",
      "where": {
        "type": "integration"
      }
    },
    "confidence": 0.86
  },
  {
    "id": "requires_needs",
    "category": "technical",
    "examples": [
      "requires Python 3",
      "needs Node.js",
      "dependencies for"
    ],
    "pattern": "(?:requires?|needs?|dependencies\\s+for)\\s+(.+)",
    "template": {
      "like": "${1} requirements",
      "where": {
        "requirements": "${1}"
      }
    },
    "confidence": 0.86
  },
  {
    "id": "compatible_with",
    "category": "technical",
    "examples": [
      "compatible with Python 3",
      "works with React",
      "supports Windows"
    ],
    "pattern": "(?:compatible\\s+with|works\\s+with|supports)\\s+(.+)",
    "template": {
      "like": "${1} compatibility",
      "where": {
        "compatibility": "${1}"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "temporal_from_year",
    "category": "temporal",
    "examples": [
      "papers from 2023",
      "research from 2022",
      "models from last year"
    ],
    "pattern": "(.+) from (\\d{4})",
    "template": {
      "like": "${1}",
      "where": {
        "year": "${2}"
      }
    },
    "confidence": 0.95
  },
  {
    "id": "temporal_after",
    "category": "temporal",
    "examples": [
      "papers after 2020",
      "research after January",
      "models after GPT-3"
    ],
    "pattern": "(.+) after (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "date": {
          "greaterThan": "${2}"
        }
      }
    },
    "confidence": 0.9
  },
  {
    "id": "temporal_before",
    "category": "temporal",
    "examples": [
      "papers before 2020",
      "research before transformer",
      "models before BERT"
    ],
    "pattern": "(.+) before (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "date": {
          "lessThan": "${2}"
        }
      }
    },
    "confidence": 0.9
  },
  {
    "id": "temporal_recent",
    "category": "temporal",
    "examples": [
      "recent papers",
      "latest research",
      "new models"
    ],
    "pattern": "(recent|latest|new|newest) (.+)",
    "template": {
      "like": "${2}",
      "boost": "recent"
    },
    "confidence": 0.9
  },
  {
    "id": "temporal_this_period",
    "category": "temporal",
    "examples": [
      "papers this year",
      "research this month",
      "models this week"
    ],
    "pattern": "(.+) this (week|month|year|quarter)",
    "template": {
      "like": "${1}",
      "where": {
        "date": {
          "greaterThan": "start of ${2}"
        }
      }
    },
    "confidence": 0.9
  },
  {
    "id": "latest_newest",
    "category": "temporal",
    "examples": [
      "latest research",
      "newest papers",
      "most recent updates"
    ],
    "pattern": "(?:latest|newest|most\\s+recent|current)\\s+(.+)",
    "template": {
      "like": "${1}",
      "boost": "recent"
    },
    "confidence": 0.89
  },
  {
    "id": "last_period",
    "category": "temporal",
    "examples": [
      "last week",
      "past month",
      "previous year"
    ],
    "pattern": "(?:last|past|previous)\\s+(week|month|year|day)",
    "template": {
      "where": {
        "date": {
          "after": "${1}_ago"
        }
      }
    },
    "confidence": 0.87
  },
  {
    "id": "between_dates",
    "category": "temporal",
    "examples": [
      "between 2020 and 2023",
      "from January to March"
    ],
    "pattern": "between\\s+(\\d{4}|\\w+)\\s+(?:and|to)\\s+(\\d{4}|\\w+)",
    "template": {
      "where": {
        "date": {
          "between": [
            "${1}",
            "${2}"
          ]
        }
      }
    },
    "confidence": 0.86
  },
  {
    "id": "trending_popular",
    "category": "temporal",
    "examples": [
      "trending topics",
      "popular papers",
      "hot discussions"
    ],
    "pattern": "(?:trending|popular|hot|viral)\\s+(.+)",
    "template": {
      "like": "${1}",
      "boost": "popular"
    },
    "confidence": 0.86
  },
  {
    "id": "temporal_between",
    "category": "temporal",
    "examples": [
      "papers between 2020 and 2023",
      "research from 2021 to 2022"
    ],
    "pattern": "(.+) (between|from) (.+) (and|to) (.+)",
    "template": {
      "like": "${1}",
      "where": {
        "date": {
          "between": [
            "${3}",
            "${5}"
          ]
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "temporal_last_n_days",
    "category": "temporal",
    "examples": [
      "papers last 30 days",
      "research last week",
      "models last month"
    ],
    "pattern": "(.+) last (\\d+) (days|weeks|months|years)",
    "template": {
      "like": "${1}",
      "where": {
        "date": {
          "greaterThan": "${2} ${3} ago"
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "when_temporal",
    "category": "temporal",
    "examples": [
      "when was Python created",
      "when did AI start"
    ],
    "pattern": "when\\s+(?:was|did|were)\\s+(.+?)\\s+(?:created|started|invented|published)",
    "template": {
      "like": "${1}",
      "where": {
        "date": {
          "exists": true
        }
      }
    },
    "confidence": 0.85
  },
  {
    "id": "deprecated_obsolete",
    "category": "temporal",
    "examples": [
      "deprecated features",
      "obsolete methods",
      "legacy code"
    ],
    "pattern": "(?:deprecated|obsolete|legacy|outdated)\\s+(.+)",
    "template": {
      "like": "${1}",
      "where": {
        "status": "deprecated"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "roadmap_timeline",
    "category": "temporal",
    "examples": [
      "roadmap for React",
      "timeline of AI development",
      "history of Python"
    ],
    "pattern": "(?:roadmap|timeline|history)\\s+(?:for|of)\\s+(.+)",
    "template": {
      "like": "${1} roadmap",
      "boost": "timeline"
    },
    "confidence": 0.85
  },
  {
    "id": "under_development",
    "category": "temporal",
    "examples": [
      "under development",
      "coming soon",
      "in progress"
    ],
    "pattern": "(?:under\\s+development|coming\\s+soon|in\\s+progress|upcoming)\\s*(.+)?",
    "template": {
      "like": "${1}",
      "where": {
        "status": "development"
      }
    },
    "confidence": 0.84
  },
  {
    "id": "trans_buy",
    "category": "transactional",
    "examples": [
      "buy GPU",
      "purchase subscription",
      "order dataset"
    ],
    "pattern": "(buy|purchase|order|get) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "product",
        "available": true
      }
    },
    "confidence": 0.9
  },
  {
    "id": "trans_download",
    "category": "transactional",
    "examples": [
      "download model",
      "download dataset",
      "get paper PDF"
    ],
    "pattern": "(download|get|fetch) (.+)",
    "template": {
      "like": "${2}",
      "where": {
        "type": "downloadable"
      }
    },
    "confidence": 0.9
  },
  {
    "id": "trans_subscribe",
    "category": "transactional",
    "examples": [
      "subscribe to newsletter",
      "follow updates"
    ],
    "pattern": "(subscribe|follow|watch) (to )? (.+)",
    "template": {
      "like": "${3}",
      "where": {
        "type": "subscription"
      }
    },
    "confidence": 0.85
  },
  {
    "id": "action_get",
    "category": "transactional",
    "examples": [
      "get all papers",
      "fetch datasets",
      "retrieve models"
    ],
    "pattern": "(get|fetch|retrieve) (all )? (.+)",
    "template": {
      "like": "${3}"
    },
    "confidence": 0.85
  },
  {
    "id": "action_download",
    "category": "transactional",
    "examples": [
      "download Python",
      "download the dataset",
      "get the PDF"
    ],
    "pattern": "(?:download|get|fetch)\\s+(?:the\\s+)?(.+?)\\s*(?:pdf|file|document|dataset)?",
    "template": {
      "like": "${1}",
      "where": {
        "downloadable": true
      }
    },
    "confidence": 0.85
  },
  {
    "id": "action_create",
    "category": "transactional",
    "examples": [
      "create new project",
      "make a new document",
      "generate report"
    ],
    "pattern": "(?:create|make|generate|build)\\s+(?:new\\s+)?(.+)",
    "template": {
      "like": "${1} template",
      "boost": "tutorial"
    },
    "confidence": 0.82
  }
]

// Pre-computed embeddings (440.0KB base64)
const EMBEDDINGS_BASE64 = "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"

// Decode embeddings at startup (happens once, <10ms)
function decodeEmbeddings(): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Buffer.from(EMBEDDINGS_BASE64, 'base64')
  } else if (typeof atob !== 'undefined') {
    // Browser environment
    const binaryString = atob(EMBEDDINGS_BASE64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }
  return new Uint8Array(0)
}

// Cached decoded embeddings
let decodedEmbeddings: Uint8Array | null = null

/**
 * Get pattern embeddings as a Map for fast lookup
 * This is called once at startup and cached
 */
export function getPatternEmbeddings(): Map<string, Float32Array> {
  if (!decodedEmbeddings) {
    decodedEmbeddings = decodeEmbeddings()
  }
  
  const embeddings = new Map<string, Float32Array>()
  const view = new DataView(decodedEmbeddings.buffer)
  const embeddingSize = 384
  
  EMBEDDED_PATTERNS.forEach((pattern, index) => {
    const offset = index * embeddingSize * 4
    const embedding = new Float32Array(embeddingSize)
    
    for (let i = 0; i < embeddingSize; i++) {
      embedding[i] = view.getFloat32(offset + i * 4, true)
    }
    
    embeddings.set(pattern.id, embedding)
  })
  
  return embeddings
}

// Export metadata for monitoring
export const PATTERNS_METADATA = {
  version: "2.0.0",
  totalPatterns: 220,
  categories: ["academic","aggregation","combined","commercial","comparative","contextual","conversational","domain","domain_specific","existence","filtering","informational","navigational","relational","spatial","technical","temporal","transactional"],
  domains: ["academic","ai","ecommerce","financial","legal","medical","programming","social","tech","technical"],
  embeddingDimensions: 384,
  averageConfidence: 0.891,
  coverage: {
    general: "95%+",
    programming: "95%+",
    ai_ml: "95%+",
    social: "90%+",
    medical_legal: "85-90%",
    financial_academic: "85-90%",
    ecommerce: "90%+",
    overall: "94-98%"
  },
  sizeBytes: {
    patterns: 65573,
    embeddings: 337920,
    total: 403493
  }
}

console.log(`🧠 Brainy Pattern Library loaded: ${EMBEDDED_PATTERNS.length} patterns, ${(PATTERNS_METADATA.sizeBytes.total / 1024).toFixed(1)}KB total`)
