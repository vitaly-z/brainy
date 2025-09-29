/**
 * 🧠 BRAINY EMBEDDED PATTERNS
 * 
 * AUTO-GENERATED - DO NOT EDIT
 * Generated: 2025-09-29T17:05:30.153Z
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

// Only log if not suppressed - controlled by logging configuration
import { prodLog } from '../utils/logger.js'
prodLog.info(`🧠 Brainy Pattern Library loaded: ${EMBEDDED_PATTERNS.length} patterns, ${(PATTERNS_METADATA.sizeBytes.total / 1024).toFixed(1)}KB total`)
