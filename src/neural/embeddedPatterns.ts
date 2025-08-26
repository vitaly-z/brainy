/**
 * 🧠 BRAINY EMBEDDED PATTERNS
 * 
 * AUTO-GENERATED - DO NOT EDIT
 * Generated: 2025-08-26T19:59:35.203Z
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
