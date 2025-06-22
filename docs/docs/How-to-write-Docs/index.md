# Creating a Page and Styling It in MkDocs

## 📄 1. Create a New Page

1. Go to your `docs/` folder.
2. Create a new `.md` file — for example:

```bash
touch docs/my-page.md
```

3. Add it to your `mkdocs.yml` file under `nav`:

```yaml
nav:
  - Home: index.md
  - My Page: my-page.md
```

---

## ✨ 2. Add Content and Style It

### Headings

```markdown
# Main Title
## Section Title
### Subsection Title
```

---

### Paragraphs and Line Breaks

- Write normal text in paragraphs.
- Use two spaces at the end of a line for a line break.

---

### Lists

```markdown
- Item 1
- Item 2
  - Subitem
```

---

### Code Blocks

#### Inline Code

Use backticks `` `` `` for short code:

``
Use the `print()` function to display output.
``

#### Multiline Code

Use triple backticks for blocks:

``` py
def hello():
    print("Hello, world!")
```
You can specify the language for syntax highlighting: `python`, `bash`, `yaml`, `json`, etc.

---

### Quotes and Notes

Use `>` for blockquotes:

```markdown
> This is a tip or important note.
```

With MkDocs Material theme, you can use **admonitions** (if enabled):

```markdown
!!! tip "Shortcut"
    Press `Ctrl + C` to stop the server.
```
