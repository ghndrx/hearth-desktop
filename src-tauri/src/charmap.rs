//! Character Map - browse and search special characters, symbols, and Unicode
//!
//! Provides categorized character collections and search for quick insertion
//! into chat messages.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharCategory {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub chars: Vec<CharEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharEntry {
    pub char: String,
    pub name: String,
    pub codepoint: String,
}

fn entry(ch: char, name: &str) -> CharEntry {
    CharEntry {
        char: ch.to_string(),
        name: name.to_string(),
        codepoint: format!("U+{:04X}", ch as u32),
    }
}

fn build_categories() -> Vec<CharCategory> {
    vec![
        CharCategory {
            id: "arrows".into(),
            name: "Arrows".into(),
            icon: "->".into(),
            chars: vec![
                entry('\u{2190}', "Left Arrow"),
                entry('\u{2191}', "Up Arrow"),
                entry('\u{2192}', "Right Arrow"),
                entry('\u{2193}', "Down Arrow"),
                entry('\u{2194}', "Left Right Arrow"),
                entry('\u{2195}', "Up Down Arrow"),
                entry('\u{2196}', "North West Arrow"),
                entry('\u{2197}', "North East Arrow"),
                entry('\u{2198}', "South East Arrow"),
                entry('\u{2199}', "South West Arrow"),
                entry('\u{21A9}', "Left Hook Arrow"),
                entry('\u{21AA}', "Right Hook Arrow"),
                entry('\u{21B0}', "Up Arrow With Tip Left"),
                entry('\u{21B1}', "Up Arrow With Tip Right"),
                entry('\u{21BB}', "Clockwise Arrow"),
                entry('\u{21BA}', "Counter-Clockwise Arrow"),
                entry('\u{21D0}', "Double Left Arrow"),
                entry('\u{21D1}', "Double Up Arrow"),
                entry('\u{21D2}', "Double Right Arrow"),
                entry('\u{21D3}', "Double Down Arrow"),
                entry('\u{21D4}', "Double Left Right Arrow"),
                entry('\u{27A1}', "Heavy Right Arrow"),
                entry('\u{2B05}', "Heavy Left Arrow"),
                entry('\u{2B06}', "Heavy Up Arrow"),
                entry('\u{2B07}', "Heavy Down Arrow"),
            ],
        },
        CharCategory {
            id: "math".into(),
            name: "Math".into(),
            icon: "+-".into(),
            chars: vec![
                entry('\u{00B1}', "Plus Minus"),
                entry('\u{00D7}', "Multiplication"),
                entry('\u{00F7}', "Division"),
                entry('\u{2260}', "Not Equal"),
                entry('\u{2264}', "Less Than Or Equal"),
                entry('\u{2265}', "Greater Than Or Equal"),
                entry('\u{2248}', "Approximately Equal"),
                entry('\u{221E}', "Infinity"),
                entry('\u{2211}', "Summation"),
                entry('\u{220F}', "Product"),
                entry('\u{221A}', "Square Root"),
                entry('\u{222B}', "Integral"),
                entry('\u{2202}', "Partial Differential"),
                entry('\u{2207}', "Nabla"),
                entry('\u{2208}', "Element Of"),
                entry('\u{2209}', "Not Element Of"),
                entry('\u{2229}', "Intersection"),
                entry('\u{222A}', "Union"),
                entry('\u{2282}', "Subset Of"),
                entry('\u{2283}', "Superset Of"),
                entry('\u{2205}', "Empty Set"),
                entry('\u{2200}', "For All"),
                entry('\u{2203}', "There Exists"),
                entry('\u{00B0}', "Degree"),
                entry('\u{03C0}', "Pi"),
                entry('\u{0394}', "Delta"),
                entry('\u{03A3}', "Sigma"),
                entry('\u{03A9}', "Omega"),
            ],
        },
        CharCategory {
            id: "currency".into(),
            name: "Currency".into(),
            icon: "$".into(),
            chars: vec![
                entry('\u{0024}', "Dollar"),
                entry('\u{20AC}', "Euro"),
                entry('\u{00A3}', "Pound"),
                entry('\u{00A5}', "Yen"),
                entry('\u{20A3}', "Franc"),
                entry('\u{20B9}', "Indian Rupee"),
                entry('\u{20BD}', "Ruble"),
                entry('\u{20A9}', "Won"),
                entry('\u{20BA}', "Turkish Lira"),
                entry('\u{20BF}', "Bitcoin"),
                entry('\u{00A2}', "Cent"),
                entry('\u{20B1}', "Peso"),
                entry('\u{20AB}', "Dong"),
                entry('\u{20AA}', "Sheqel"),
                entry('\u{20B4}', "Hryvnia"),
            ],
        },
        CharCategory {
            id: "punctuation".into(),
            name: "Punctuation".into(),
            icon: "..".into(),
            chars: vec![
                entry('\u{2026}', "Ellipsis"),
                entry('\u{2014}', "Em Dash"),
                entry('\u{2013}', "En Dash"),
                entry('\u{2018}', "Left Single Quote"),
                entry('\u{2019}', "Right Single Quote"),
                entry('\u{201C}', "Left Double Quote"),
                entry('\u{201D}', "Right Double Quote"),
                entry('\u{00AB}', "Left Guillemet"),
                entry('\u{00BB}', "Right Guillemet"),
                entry('\u{2022}', "Bullet"),
                entry('\u{00B7}', "Middle Dot"),
                entry('\u{2020}', "Dagger"),
                entry('\u{2021}', "Double Dagger"),
                entry('\u{00A7}', "Section"),
                entry('\u{00B6}', "Pilcrow"),
                entry('\u{2016}', "Double Vertical Line"),
                entry('\u{00A9}', "Copyright"),
                entry('\u{00AE}', "Registered"),
                entry('\u{2122}', "Trademark"),
                entry('\u{00BF}', "Inverted Question"),
                entry('\u{00A1}', "Inverted Exclamation"),
            ],
        },
        CharCategory {
            id: "shapes".into(),
            name: "Shapes".into(),
            icon: "[]".into(),
            chars: vec![
                entry('\u{25A0}', "Black Square"),
                entry('\u{25A1}', "White Square"),
                entry('\u{25B2}', "Black Up Triangle"),
                entry('\u{25B3}', "White Up Triangle"),
                entry('\u{25BC}', "Black Down Triangle"),
                entry('\u{25BD}', "White Down Triangle"),
                entry('\u{25C6}', "Black Diamond"),
                entry('\u{25C7}', "White Diamond"),
                entry('\u{25CB}', "White Circle"),
                entry('\u{25CF}', "Black Circle"),
                entry('\u{25D0}', "Half Circle Left"),
                entry('\u{25D1}', "Half Circle Right"),
                entry('\u{2605}', "Black Star"),
                entry('\u{2606}', "White Star"),
                entry('\u{2660}', "Spade"),
                entry('\u{2663}', "Club"),
                entry('\u{2665}', "Heart"),
                entry('\u{2666}', "Diamond Suit"),
                entry('\u{266A}', "Eighth Note"),
                entry('\u{266B}', "Beamed Notes"),
                entry('\u{2713}', "Check Mark"),
                entry('\u{2717}', "Ballot X"),
                entry('\u{2716}', "Heavy X"),
                entry('\u{2714}', "Heavy Check"),
            ],
        },
        CharCategory {
            id: "box_drawing".into(),
            name: "Box Drawing".into(),
            icon: "|-".into(),
            chars: vec![
                entry('\u{2500}', "Light Horizontal"),
                entry('\u{2502}', "Light Vertical"),
                entry('\u{250C}', "Light Down Right"),
                entry('\u{2510}', "Light Down Left"),
                entry('\u{2514}', "Light Up Right"),
                entry('\u{2518}', "Light Up Left"),
                entry('\u{251C}', "Light Vertical Right"),
                entry('\u{2524}', "Light Vertical Left"),
                entry('\u{252C}', "Light Down Horizontal"),
                entry('\u{2534}', "Light Up Horizontal"),
                entry('\u{253C}', "Light Cross"),
                entry('\u{2550}', "Double Horizontal"),
                entry('\u{2551}', "Double Vertical"),
                entry('\u{2554}', "Double Down Right"),
                entry('\u{2557}', "Double Down Left"),
                entry('\u{255A}', "Double Up Right"),
                entry('\u{255D}', "Double Up Left"),
                entry('\u{2588}', "Full Block"),
                entry('\u{2591}', "Light Shade"),
                entry('\u{2592}', "Medium Shade"),
                entry('\u{2593}', "Dark Shade"),
            ],
        },
        CharCategory {
            id: "greek".into(),
            name: "Greek".into(),
            icon: "ab".into(),
            chars: vec![
                entry('\u{0391}', "Alpha Upper"),
                entry('\u{03B1}', "Alpha Lower"),
                entry('\u{0392}', "Beta Upper"),
                entry('\u{03B2}', "Beta Lower"),
                entry('\u{0393}', "Gamma Upper"),
                entry('\u{03B3}', "Gamma Lower"),
                entry('\u{0394}', "Delta Upper"),
                entry('\u{03B4}', "Delta Lower"),
                entry('\u{0395}', "Epsilon Upper"),
                entry('\u{03B5}', "Epsilon Lower"),
                entry('\u{0398}', "Theta Upper"),
                entry('\u{03B8}', "Theta Lower"),
                entry('\u{039B}', "Lambda Upper"),
                entry('\u{03BB}', "Lambda Lower"),
                entry('\u{039C}', "Mu Upper"),
                entry('\u{03BC}', "Mu Lower"),
                entry('\u{03A0}', "Pi Upper"),
                entry('\u{03C0}', "Pi Lower"),
                entry('\u{03A3}', "Sigma Upper"),
                entry('\u{03C3}', "Sigma Lower"),
                entry('\u{03A6}', "Phi Upper"),
                entry('\u{03C6}', "Phi Lower"),
                entry('\u{03A8}', "Psi Upper"),
                entry('\u{03C8}', "Psi Lower"),
                entry('\u{03A9}', "Omega Upper"),
                entry('\u{03C9}', "Omega Lower"),
            ],
        },
        CharCategory {
            id: "superscript".into(),
            name: "Super/Subscript".into(),
            icon: "x2".into(),
            chars: vec![
                entry('\u{00B9}', "Superscript 1"),
                entry('\u{00B2}', "Superscript 2"),
                entry('\u{00B3}', "Superscript 3"),
                entry('\u{2074}', "Superscript 4"),
                entry('\u{2075}', "Superscript 5"),
                entry('\u{2076}', "Superscript 6"),
                entry('\u{2077}', "Superscript 7"),
                entry('\u{2078}', "Superscript 8"),
                entry('\u{2079}', "Superscript 9"),
                entry('\u{2070}', "Superscript 0"),
                entry('\u{207A}', "Superscript Plus"),
                entry('\u{207B}', "Superscript Minus"),
                entry('\u{2080}', "Subscript 0"),
                entry('\u{2081}', "Subscript 1"),
                entry('\u{2082}', "Subscript 2"),
                entry('\u{2083}', "Subscript 3"),
                entry('\u{2084}', "Subscript 4"),
                entry('\u{2085}', "Subscript 5"),
                entry('\u{2086}', "Subscript 6"),
                entry('\u{2087}', "Subscript 7"),
                entry('\u{2088}', "Subscript 8"),
                entry('\u{2089}', "Subscript 9"),
            ],
        },
    ]
}

#[tauri::command]
pub fn charmap_get_categories() -> Vec<CharCategory> {
    build_categories()
}

#[tauri::command]
pub fn charmap_search(query: String) -> Vec<CharEntry> {
    let q = query.to_lowercase();
    if q.is_empty() {
        return Vec::new();
    }

    let categories = build_categories();
    let mut results = Vec::new();

    for cat in &categories {
        for entry in &cat.chars {
            if entry.name.to_lowercase().contains(&q)
                || entry.codepoint.to_lowercase().contains(&q)
                || entry.char == q
            {
                results.push(entry.clone());
            }
        }
    }

    results.truncate(50);
    results
}

#[tauri::command]
pub fn charmap_get_char_info(ch: String) -> Option<CharEntry> {
    if let Some(c) = ch.chars().next() {
        Some(CharEntry {
            char: c.to_string(),
            name: format!("U+{:04X}", c as u32),
            codepoint: format!("U+{:04X}", c as u32),
        })
    } else {
        None
    }
}
