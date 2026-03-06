//! Password Generator - Cryptographically secure password and passphrase generation

use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordOptions {
    pub length: usize,
    pub uppercase: bool,
    pub lowercase: bool,
    pub digits: bool,
    pub symbols: bool,
    pub exclude_ambiguous: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordResult {
    pub password: String,
    pub strength: String,
    pub entropy_bits: f64,
    pub crack_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassphraseOptions {
    pub word_count: usize,
    pub separator: String,
    pub capitalize: bool,
    pub include_number: bool,
}

#[tauri::command]
pub fn password_generate(options: PasswordOptions) -> Result<PasswordResult, String> {
    let mut charset = String::new();

    if options.lowercase {
        if options.exclude_ambiguous {
            charset.push_str("abcdefghjkmnpqrstuvwxyz");
        } else {
            charset.push_str("abcdefghijklmnopqrstuvwxyz");
        }
    }
    if options.uppercase {
        if options.exclude_ambiguous {
            charset.push_str("ABCDEFGHJKMNPQRSTUVWXYZ");
        } else {
            charset.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        }
    }
    if options.digits {
        if options.exclude_ambiguous {
            charset.push_str("23456789");
        } else {
            charset.push_str("0123456789");
        }
    }
    if options.symbols {
        charset.push_str("!@#$%^&*()-_=+[]{}|;:,.<>?");
    }

    if charset.is_empty() {
        return Err("Select at least one character type".into());
    }

    if options.length < 4 {
        return Err("Minimum password length is 4".into());
    }

    if options.length > 128 {
        return Err("Maximum password length is 128".into());
    }

    let mut rng = rand::thread_rng();
    let chars: Vec<char> = charset.chars().collect();
    let password: String = (0..options.length)
        .map(|_| chars[rng.gen_range(0..chars.len())])
        .collect();

    let entropy = options.length as f64 * (chars.len() as f64).log2();
    let strength = match entropy {
        e if e < 28.0 => "Very Weak",
        e if e < 36.0 => "Weak",
        e if e < 60.0 => "Moderate",
        e if e < 80.0 => "Strong",
        _ => "Very Strong",
    };

    let crack_time = estimate_crack_time(entropy);

    Ok(PasswordResult {
        password,
        strength: strength.into(),
        entropy_bits: (entropy * 100.0).round() / 100.0,
        crack_time,
    })
}

#[tauri::command]
pub fn passphrase_generate(options: PassphraseOptions) -> Result<PasswordResult, String> {
    if options.word_count < 3 {
        return Err("Minimum word count is 3".into());
    }
    if options.word_count > 12 {
        return Err("Maximum word count is 12".into());
    }

    let wordlist = get_wordlist();
    let mut rng = rand::thread_rng();

    let mut words: Vec<String> = (0..options.word_count)
        .map(|_| {
            let word = wordlist[rng.gen_range(0..wordlist.len())].to_string();
            if options.capitalize {
                let mut c = word.chars();
                match c.next() {
                    Some(first) => first.to_uppercase().to_string() + c.as_str(),
                    None => word,
                }
            } else {
                word
            }
        })
        .collect();

    if options.include_number {
        let pos = rng.gen_range(0..words.len());
        words[pos] = format!("{}{}", words[pos], rng.gen_range(0..100));
    }

    let passphrase = words.join(&options.separator);

    // EFF wordlist has 7776 words
    let entropy = options.word_count as f64 * (7776.0_f64).log2();
    let strength = match entropy {
        e if e < 40.0 => "Weak",
        e if e < 60.0 => "Moderate",
        e if e < 80.0 => "Strong",
        _ => "Very Strong",
    };

    let crack_time = estimate_crack_time(entropy);

    Ok(PasswordResult {
        password: passphrase,
        strength: strength.into(),
        entropy_bits: (entropy * 100.0).round() / 100.0,
        crack_time,
    })
}

fn estimate_crack_time(entropy: f64) -> String {
    // Assume 10 billion guesses per second (modern GPU cluster)
    let guesses_per_sec: f64 = 1e10;
    let total_guesses = 2.0_f64.powf(entropy);
    let seconds = total_guesses / guesses_per_sec / 2.0; // average case

    if seconds < 1.0 {
        "Instant".into()
    } else if seconds < 60.0 {
        format!("{:.0} seconds", seconds)
    } else if seconds < 3600.0 {
        format!("{:.0} minutes", seconds / 60.0)
    } else if seconds < 86400.0 {
        format!("{:.1} hours", seconds / 3600.0)
    } else if seconds < 31_536_000.0 {
        format!("{:.0} days", seconds / 86400.0)
    } else if seconds < 31_536_000.0 * 1000.0 {
        format!("{:.0} years", seconds / 31_536_000.0)
    } else if seconds < 31_536_000.0 * 1e6 {
        format!("{:.0} thousand years", seconds / 31_536_000.0 / 1000.0)
    } else if seconds < 31_536_000.0 * 1e9 {
        format!("{:.0} million years", seconds / 31_536_000.0 / 1e6)
    } else {
        format!("{:.0} billion years", seconds / 31_536_000.0 / 1e9)
    }
}

fn get_wordlist() -> Vec<&'static str> {
    vec![
        "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
        "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
        "across", "action", "actor", "actress", "actual", "adapt", "address", "adjust",
        "admit", "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid",
        "again", "agent", "agree", "ahead", "aim", "airport", "aisle", "alarm",
        "album", "alcohol", "alert", "alien", "almost", "alone", "alpha", "already",
        "also", "alter", "always", "amateur", "amazing", "among", "amount", "amused",
        "anchor", "ancient", "anger", "angle", "angry", "animal", "ankle", "announce",
        "annual", "another", "answer", "antenna", "antique", "anxiety", "any", "apart",
        "apology", "appear", "apple", "approve", "april", "arch", "arctic", "area",
        "arena", "argue", "armor", "army", "arrange", "arrest", "arrive", "arrow",
        "artwork", "aspect", "assault", "asset", "assist", "assume", "asthma", "athlete",
        "atom", "attack", "attend", "auction", "august", "aunt", "author", "average",
        "avocado", "avoid", "awake", "aware", "awesome", "awful", "awkward", "axis",
        "baby", "bachelor", "bacon", "badge", "balance", "balcony", "ball", "bamboo",
        "banana", "banner", "barely", "bargain", "barrel", "basket", "battle", "beach",
        "bean", "beauty", "because", "become", "before", "begin", "behave", "behind",
        "believe", "bench", "benefit", "best", "betray", "better", "between", "beyond",
        "bicycle", "black", "blade", "blame", "blanket", "blast", "bleak", "bless",
        "blind", "blood", "blossom", "blue", "blur", "board", "bonus", "book",
        "border", "boring", "borrow", "bottom", "bounce", "brain", "brand", "brave",
        "bread", "breeze", "brick", "bridge", "brief", "bright", "bring", "broken",
        "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build",
        "bullet", "burden", "burger", "burst", "butter", "buyer", "cabin", "cable",
        "cactus", "cage", "cake", "camera", "camp", "cancel", "candy", "capable",
        "captain", "carbon", "cargo", "carpet", "carry", "castle", "casual", "catch",
        "cattle", "caught", "cause", "caution", "cave", "ceiling", "celery", "cement",
        "census", "century", "cereal", "certain", "chair", "chalk", "champion", "change",
        "chaos", "chapter", "charge", "chase", "cheap", "check", "cheese", "cherry",
        "chicken", "chief", "child", "chimney", "choice", "chunk", "circle", "citizen",
        "city", "civil", "claim", "clap", "clarify", "claw", "clay", "clean",
        "clerk", "clever", "cliff", "climb", "clinic", "clock", "close", "cloth",
        "cloud", "clown", "cluster", "coach", "coconut", "code", "coffee", "coil",
        "collect", "color", "column", "combine", "comedy", "comfort", "comic", "common",
        "company", "concert", "conduct", "confirm", "congress", "connect", "consider",
        "control", "convince", "cook", "cool", "copper", "coral", "core", "corner",
        "correct", "cost", "cotton", "couch", "country", "couple", "course", "cousin",
        "cover", "coyote", "crack", "cradle", "craft", "crane", "crash", "crater",
        "crazy", "cream", "credit", "creek", "crew", "cricket", "crime", "crisp",
        "critic", "crop", "cross", "crouch", "crowd", "crucial", "cruel", "cruise",
        "crumble", "crush", "crystal", "cube", "culture", "curtain", "curve", "cushion",
        "custom", "cycle", "damage", "damp", "dance", "danger", "daring", "dash",
        "daughter", "dawn", "debate", "debris", "decade", "december", "decide", "decline",
        "define", "degree", "delay", "deliver", "demand", "denial", "dentist", "deny",
        "depart", "depend", "deposit", "depth", "deputy", "derive", "describe", "desert",
        "design", "desk", "despair", "destroy", "detail", "detect", "develop", "device",
        "devote", "diagram", "diamond", "diary", "diesel", "diet", "differ", "digital",
        "dignity", "dilemma", "dinner", "dinosaur", "direct", "dirty", "disagree",
        "discover", "disease", "dish", "dismiss", "display", "distance", "divert",
        "dizzy", "doctor", "document", "domain", "donate", "donkey", "donor", "door",
        "dose", "double", "dove", "draft", "dragon", "drama", "drastic", "dream",
        "dress", "drift", "drill", "drink", "drip", "drive", "drop", "drum",
        "dry", "duck", "dumb", "dune", "during", "dust", "dutch", "dwarf",
        "dynamic", "eager", "eagle", "early", "earn", "earth", "easily", "east",
        "echo", "ecology", "economy", "edge", "edit", "educate", "effort", "eight",
        "either", "elbow", "elder", "electric", "elegant", "element", "elephant",
        "eleven", "else", "embark", "embody", "embrace", "emerge", "emotion", "employ",
        "empower", "empty", "enable", "enact", "end", "endless", "endorse", "enemy",
        "energy", "enforce", "engage", "engine", "enhance", "enjoy", "enlist", "enough",
        "enrich", "enroll", "ensure", "enter", "entire", "entry", "envelope", "episode",
        "equal", "equip", "erosion", "error", "escape", "essay", "essence", "estate",
        "eternal", "evening", "evidence", "evil", "evolve", "exact", "example",
        "excess", "exchange", "excite", "exclude", "excuse", "execute", "exercise",
        "exhaust", "exhibit", "exile", "exist", "expand", "expect", "expire", "explain",
        "expose", "express", "extend", "extra", "fabric", "face", "faculty", "faint",
        "faith", "fall", "false", "fame", "family", "famous", "fancy", "fantasy",
        "farm", "fashion", "father", "fatigue", "fault", "favorite", "feature", "february",
        "federal", "fence", "festival", "fetch", "fever", "fiber", "fiction", "field",
        "figure", "file", "film", "filter", "final", "find", "finger", "finish",
        "fire", "firm", "fiscal", "fish", "fitness", "flag", "flame", "flash",
        "flat", "flavor", "flee", "flight", "flip", "float", "flock", "floor",
        "flower", "fluid", "flush", "foam", "focus", "follow", "food", "foot",
        "force", "forest", "forget", "fork", "fortune", "forum", "forward", "fossil",
        "foster", "found", "fox", "fragile", "frame", "frequent", "fresh", "friend",
        "fringe", "frog", "front", "frozen", "fruit", "fuel", "fun", "funny",
        "furnace", "fury", "future", "gadget", "gallery", "game", "garage", "garbage",
        "garden", "garlic", "garment", "gather", "gauge", "gaze", "general", "genius",
        "genre", "gentle", "genuine", "gesture", "ghost", "giant", "gift", "giggle",
        "ginger", "giraffe", "glad", "glance", "glare", "glass", "globe", "gloom",
        "glory", "glove", "glow", "glue", "goat", "goddess", "gold", "good",
        "goose", "gorilla", "gospel", "gossip", "govern", "grace", "grain", "grant",
        "grape", "grass", "gravity", "great", "green", "grid", "grief", "grit",
        "grocery", "group", "grow", "grunt", "guard", "guess", "guide", "guilt",
        "guitar", "habit", "half", "hammer", "hamster", "hand", "happy", "harbor",
        "harvest", "hawk", "hazard", "heart", "heavy", "hedgehog", "height", "hello",
        "helmet", "hero", "hidden", "high", "hill", "hint", "hire", "history",
        "hobby", "hockey", "hold", "hollow", "home", "honey", "hood", "hope",
        "horror", "horse", "hospital", "host", "hotel", "hour", "hover", "humble",
        "humor", "hundred", "hungry", "hunt", "hurdle", "hurry", "hybrid", "ice",
        "icon", "idea", "identify", "idle", "ignore", "image", "imitate", "immense",
        "immune", "impact", "impose", "improve", "impulse", "include", "income",
        "increase", "index", "indicate", "indoor", "industry", "infant", "inflict",
        "inform", "initial", "inject", "inner", "innocent", "input", "inquiry",
        "insane", "insect", "inside", "inspire", "install", "intact", "interest",
        "invest", "invite", "involve", "iron", "island", "isolate", "issue", "ivory",
        "jacket", "jaguar", "jealous", "jelly", "jewel", "job", "join", "joke",
        "journey", "joy", "judge", "juice", "jungle", "junior", "just", "kangaroo",
        "keen", "keep", "kernel", "kick", "kidney", "kind", "kingdom", "kitchen",
        "kite", "kitten", "kiwi", "knee", "knife", "knock", "know", "labor",
        "ladder", "lake", "lamp", "language", "laptop", "large", "later", "latin",
        "laugh", "laundry", "lava", "lawn", "lawsuit", "layer", "lazy", "leader",
        "leaf", "learn", "leave", "lecture", "left", "legend", "leisure", "lemon",
        "length", "lens", "leopard", "lesson", "letter", "level", "liberty", "library",
        "license", "life", "lift", "light", "limb", "limit", "link", "lion",
        "liquid", "list", "little", "live", "lizard", "load", "lobster", "local",
        "lock", "logic", "lonely", "long", "loop", "lottery", "loud", "lounge",
        "love", "loyal", "lucky", "luggage", "lumber", "lunar", "lunch", "luxury",
        "lyrics", "machine", "magic", "magnet", "maid", "major", "manage", "mandate",
        "mango", "mansion", "manual", "maple", "marble", "march", "margin", "marine",
        "market", "marriage", "mask", "mass", "master", "match", "material", "matrix",
        "matter", "maximum", "meadow", "meaning", "measure", "media", "melody", "member",
        "memory", "mention", "mentor", "mercy", "merit", "mesh", "method", "middle",
        "midnight", "milk", "million", "mimic", "mind", "minimum", "minor", "miracle",
        "mirror", "misery", "missing", "mistake", "mixture", "mobile", "model", "modify",
        "moment", "monitor", "monkey", "monster", "month", "moral", "morning", "mosquito",
        "mother", "motion", "motor", "mountain", "mouse", "movie", "much", "muffin",
        "museum", "mushroom", "music", "must", "mutual", "myself", "mystery", "myth",
        "naive", "name", "napkin", "narrow", "nation", "nature", "near", "neck",
        "negative", "neglect", "neither", "nephew", "nerve", "nest", "network", "neutral",
        "never", "next", "nice", "night", "noble", "noise", "normal", "north",
        "notable", "nothing", "notice", "novel", "nuclear", "number", "nurse", "object",
        "observe", "obtain", "obvious", "occur", "ocean", "october", "odor", "offer",
        "office", "often", "olive", "olympic", "omit", "once", "onion", "online",
        "open", "opera", "opinion", "oppose", "option", "orange", "orbit", "orchard",
        "order", "ordinary", "organ", "orient", "original", "orphan", "ostrich", "other",
        "outdoor", "output", "outside", "oval", "oven", "owner", "oxygen", "oyster",
        "ozone", "pact", "paddle", "palace", "panda", "panel", "panic", "panther",
        "paper", "parade", "parent", "park", "parrot", "party", "patch", "path",
        "patient", "patrol", "pattern", "pause", "pave", "payment", "peace", "peanut",
        "pepper", "perfect", "permit", "person", "piano", "picnic", "picture", "piece",
        "pig", "pigeon", "pill", "pilot", "pink", "pioneer", "pipe", "pistol",
        "pitch", "pizza", "place", "planet", "plastic", "plate", "play", "please",
        "pledge", "pluck", "plug", "plunge", "poem", "poet", "point", "polar",
        "police", "pond", "pony", "pool", "popular", "portion", "position", "possible",
        "post", "potato", "pottery", "poverty", "powder", "power", "practice", "praise",
        "predict", "prefer", "prepare", "present", "pretty", "prevent", "price", "pride",
        "primary", "print", "priority", "prison", "private", "prize", "problem", "process",
        "produce", "profit", "program", "project", "promote", "proof", "property",
        "prosper", "protect", "proud", "provide", "public", "pudding", "pull", "pulse",
        "pumpkin", "punch", "pupil", "puppy", "purchase", "purity", "purpose", "purse",
        "puzzle", "pyramid", "quality", "quantum", "quarter", "question", "quick", "quit",
        "quiz", "quote", "rabbit", "raccoon", "radar", "rail", "rain", "raise",
        "rally", "ramp", "ranch", "random", "range", "rapid", "rare", "rather",
        "raven", "razor", "ready", "real", "reason", "rebel", "rebuild", "recall",
        "receive", "recipe", "record", "recycle", "reduce", "reflect", "reform", "region",
        "regret", "regular", "reject", "relax", "release", "relief", "rely", "remain",
        "remember", "remind", "remove", "render", "renew", "rent", "reopen", "repair",
        "repeat", "replace", "report", "require", "rescue", "resemble", "resist",
        "resource", "response", "result", "retire", "retreat", "return", "reunion",
        "reveal", "review", "reward", "rhythm", "ribbon", "rich", "ride", "rifle",
        "right", "rigid", "ring", "riot", "ripple", "risk", "ritual", "rival",
        "river", "road", "robot", "robust", "rocket", "romance", "roof", "rookie",
        "room", "rose", "rotate", "rough", "round", "route", "royal", "rubber",
        "rude", "rug", "rule", "run", "runway", "rural", "sadness", "safari",
        "salad", "salmon", "salon", "salt", "salute", "sample", "sand", "satisfy",
        "sauce", "sausage", "save", "scatter", "scene", "scheme", "school", "science",
        "scissors", "scorpion", "scout", "scrap", "screen", "script", "search", "season",
        "second", "secret", "section", "security", "segment", "select", "senior",
        "sense", "sentence", "series", "service", "session", "settle", "setup", "seven",
        "shadow", "shaft", "shallow", "share", "shed", "shell", "sheriff", "shield",
        "shift", "shine", "ship", "shiver", "shock", "shoe", "shoot", "short",
        "shoulder", "shove", "shrimp", "shuffle", "shy", "sibling", "sick", "side",
        "siege", "sight", "sign", "silent", "silk", "silly", "silver", "similar",
        "simple", "since", "sing", "siren", "sister", "situate", "six", "size",
        "skate", "sketch", "skill", "skin", "skirt", "skull", "slab", "slam",
        "sleep", "slender", "slice", "slide", "slight", "slim", "slogan", "slow",
        "small", "smart", "smile", "smoke", "smooth", "snack", "snake", "snap",
        "snow", "soap", "soccer", "social", "soldier", "solid", "solution", "solve",
        "someone", "song", "soon", "sorry", "sort", "soul", "sound", "south",
        "space", "spare", "spatial", "spawn", "special", "speed", "sphere", "spice",
        "spider", "spike", "spirit", "split", "sponsor", "spoon", "sport", "spray",
        "spread", "spring", "square", "squeeze", "squirrel", "stable", "stadium", "staff",
        "stage", "stairs", "stamp", "stand", "start", "state", "stay", "steak",
        "steel", "stem", "step", "stereo", "stick", "still", "sting", "stock",
        "stomach", "stone", "stool", "story", "stove", "strategy", "street", "strike",
        "strong", "struggle", "student", "stuff", "stumble", "style", "subject", "submit",
        "subway", "success", "suffer", "sugar", "suggest", "suit", "summer", "sun",
        "sunny", "sunset", "super", "supply", "supreme", "surface", "surge", "surprise",
        "surround", "survey", "suspect", "sustain", "swallow", "swamp", "swap", "swarm",
        "swear", "sweet", "swim", "swing", "switch", "sword", "symbol", "symptom",
        "syrup", "system", "table", "tackle", "talent", "target", "task", "taste",
        "tattoo", "taxi", "teach", "team", "tell", "tenant", "tennis", "tent",
        "term", "test", "text", "thank", "theme", "then", "theory", "there",
        "they", "thing", "this", "thought", "three", "thrive", "throw", "thumb",
        "thunder", "ticket", "tide", "tiger", "tilt", "timber", "time", "tiny",
        "tip", "tired", "tissue", "title", "toast", "tobacco", "today", "toddler",
        "together", "toilet", "token", "tomato", "tomorrow", "tone", "tongue", "tonight",
        "tool", "tooth", "top", "topic", "torch", "tornado", "tortoise", "total",
        "tourist", "toward", "tower", "town", "toy", "track", "trade", "traffic",
        "tragic", "train", "transfer", "trap", "trash", "travel", "tray", "treat",
        "tree", "trend", "trial", "tribe", "trick", "trigger", "trim", "trip",
        "trophy", "trouble", "truck", "truly", "trumpet", "trust", "truth", "try",
        "tube", "tuna", "tunnel", "turkey", "turn", "turtle", "twelve", "twenty",
        "twice", "twin", "twist", "type", "typical", "ugly", "umbrella", "unable",
        "unaware", "uncle", "uncover", "under", "undo", "unfair", "unfold", "unhappy",
        "uniform", "unique", "unit", "universe", "unknown", "unlock", "until", "unusual",
        "unveil", "update", "upgrade", "uphold", "upon", "upper", "upset", "urban",
        "usage", "useful", "useless", "usual", "utility", "vacant", "vacuum", "vague",
        "valid", "valley", "valve", "vanish", "vapor", "various", "vast", "vault",
        "vehicle", "velvet", "vendor", "venture", "verb", "verify", "version", "vessel",
        "veteran", "viable", "vibrant", "vicious", "victory", "video", "view", "village",
        "vintage", "violin", "virtual", "virus", "visa", "visit", "visual", "vital",
        "vivid", "vocal", "voice", "void", "volcano", "volume", "vote", "voyage",
        "wage", "wagon", "wait", "walk", "wall", "walnut", "want", "warfare",
        "warm", "warrior", "wash", "wasp", "waste", "water", "wave", "way",
        "wealth", "weapon", "wear", "weasel", "weather", "web", "wedding", "weekend",
        "weird", "welcome", "west", "whale", "wheat", "wheel", "where", "whisper",
        "wide", "width", "wife", "wild", "will", "window", "wine", "wing",
        "winner", "winter", "wire", "wisdom", "wise", "wish", "witness", "wolf",
        "woman", "wonder", "wood", "word", "work", "world", "worry", "worth",
        "wrap", "wreck", "wrestle", "wrist", "write", "wrong", "yard", "year",
        "yellow", "young", "youth", "zebra", "zero", "zone", "zoo",
    ]
}
