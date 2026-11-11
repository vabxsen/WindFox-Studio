//! The curated app catalog. It is embedded in the binary so the elevated
//! worker can refuse anything that isn't listed here.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Winget,
    Msstore,
}

impl Source {
    pub fn as_str(self) -> &'static str {
        match self {
            Source::Winget => "winget",
            Source::Msstore => "msstore",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogApp {
    /// winget package identifier (or Microsoft Store product ID).
    pub id: String,
    pub source: Source,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub recommended: bool,
    /// Installed by the elevated worker. `false` for installers that refuse
    /// to run as administrator; those run in the normal UI process.
    #[serde(default = "default_true")]
    pub elevated: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: String,
    pub glyph: String,
    #[serde(default)]
    pub hidden: bool,
    pub apps: Vec<CatalogApp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub version: u32,
    pub categories: Vec<Category>,
}

const CATALOG_JSON: &str = include_str!("../catalog.json");

/// The embedded catalog, parsed once.
pub fn catalog() -> &'static Catalog {
    static CATALOG: OnceLock<Catalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        let catalog: Catalog =
            serde_json::from_str(CATALOG_JSON).expect("embedded catalog.json must parse");
        catalog.validate().expect("embedded catalog.json must be valid");
        catalog
    })
}

impl Catalog {
    pub fn apps(&self) -> impl Iterator<Item = &CatalogApp> {
        self.categories.iter().flat_map(|c| c.apps.iter())
    }

    /// Case-insensitive lookup by package ID.
    pub fn find(&self, id: &str) -> Option<&CatalogApp> {
        self.apps().find(|a| a.id.eq_ignore_ascii_case(id))
    }

    pub fn validate(&self) -> Result<(), String> {
        let mut category_ids = HashSet::new();
        let mut app_ids = HashSet::new();
        for category in &self.categories {
            if category.id.is_empty() || category.name.is_empty() {
                return Err("a category is missing its id or name".into());
            }
            if !category_ids.insert(category.id.as_str()) {
                return Err(format!("duplicate category id '{}'", category.id));
            }
            for app in &category.apps {
                if !is_valid_package_id(&app.id) {
                    return Err(format!("invalid package id '{}'", app.id));
                }
                if app.name.trim().is_empty() || app.description.trim().is_empty() {
                    return Err(format!("app '{}' is missing its name or description", app.id));
                }
                if !app_ids.insert(app.id.to_ascii_lowercase()) {
                    return Err(format!("duplicate app id '{}'", app.id));
                }
            }
        }
        Ok(())
    }
}

/// winget IDs are dotted names like `Notepad++.Notepad++`; Store IDs are
/// alphanumeric. Anything else is rejected, which also keeps arguments safe:
/// an ID must start with a letter or digit so it can never look like a flag.
pub fn is_valid_package_id(id: &str) -> bool {
    id.len() <= 128
        && id.starts_with(|c: char| c.is_ascii_alphanumeric())
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_catalog_is_valid() {
        let catalog = catalog();
        assert!(catalog.apps().count() >= 30, "starter catalog should have ~40 apps");
        assert!(catalog.categories.iter().any(|c| c.hidden), "gpu-tools category exists");
    }

    #[test]
    fn find_is_case_insensitive() {
        assert_eq!(catalog().find("valve.steam").map(|a| a.name.as_str()), Some("Steam"));
        assert!(catalog().find("Not.A.Real.App").is_none());
    }

    #[test]
    fn rejects_unsafe_ids() {
        assert!(is_valid_package_id("Notepad++.Notepad++"));
        assert!(is_valid_package_id("9NT1R1C2HH7J"));
        assert!(!is_valid_package_id("Valve.Steam & calc"));
        assert!(!is_valid_package_id("--source"));
        assert!(!is_valid_package_id(""));
    }

    #[test]
    fn rejects_duplicates() {
        let app = CatalogApp {
            id: "A.B".into(),
            source: Source::Winget,
            name: "A".into(),
            description: "d".into(),
            recommended: false,
            elevated: true,
        };
        let catalog = Catalog {
            version: 1,
            categories: vec![Category {
                id: "x".into(),
                name: "X".into(),
                description: String::new(),
                glyph: String::new(),
                hidden: false,
                apps: vec![app.clone(), CatalogApp { id: "a.b".into(), ..app }],
            }],
        };
        assert!(catalog.validate().is_err());
    }
}
