# ECE-1779-Project

> _Project description placeholder — briefly describe what this project does, the problem it solves, and the main technologies used._

## Project Structure

```
ECE-1779-Project/
├── src/              # Main application code
│   ├── __init__.py
│   └── main.py       # Entry point
├── tests/            # Tests (pytest)
│   └── test_sample.py
├── docs/             # Documentation, architecture diagrams, report drafts
├── scripts/          # Deployment / data-processing scripts
├── requirements.txt  # Python dependencies
├── .env.example      # Environment variable template
└── README.md
```

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/geoffkylin1/ECE-1779-Project.git
   cd ECE-1779-Project
   ```

2. **Create and activate a virtual environment**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate      # macOS / Linux
   # .venv\Scripts\activate       # Windows
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Then edit .env with your own values (never commit .env)
   ```

5. **Run the app**
   ```bash
   python -m src.main
   ```

6. **Run tests**
   ```bash
   python -m pytest
   ```

## Collaboration Guidelines

### Branching Strategy

- `main` — always stable and deployable. **Do not push directly to `main`.**
- Create a branch from `main` for every task:

| Prefix      | Purpose                    | Example                     |
|-------------|----------------------------|-----------------------------|
| `feature/`  | New functionality          | `feature/user-auth`         |
| `fix/`      | Bug fixes                  | `fix/login-timeout`         |
| `docs/`     | Documentation only         | `docs/architecture-diagram` |
| `chore/`    | Tooling, config, cleanup   | `chore/update-deps`         |

### Workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature
# ...make changes...
git add .
git commit -m "feat: short description"
git push -u origin feature/your-feature
```

Then open a Pull Request into `main` and request at least one teammate's review before merging.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

### Ground Rules

- Pull from `main` often to minimize merge conflicts.
- Make sure `python -m pytest` passes before opening a PR.
- Never commit secrets — use `.env` (ignored) and keep `.env.example` updated when adding new variables.
- Add new dependencies to `requirements.txt`.
