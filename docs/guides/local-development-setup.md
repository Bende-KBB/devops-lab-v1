# Local Development Environment Setup

**Ticket:** DOL-5
**Applies to:** Windows 10/11 with WSL2
**Result:** An isolated Linux environment (`devops-lab`) with Git, GitHub SSH access, Node.js via nvm, this repo cloned, and VS Code connected to it.

This guide explains *what* each step does and *why*. Every step ends with a check, so you know it worked before moving on.

---

## The big picture

```
Windows (host)
├── Windows Terminal  (has a "devops-lab" profile)
├── VS Code           (UI runs on Windows)
└── WSL2
    ├── Ubuntu         ← work distro, default (*). Not used for this project.
    ├── docker-desktop ← Docker Desktop's internal distro. Never touch.
    └── devops-lab     ← THIS project's environment (Ubuntu 26.04 LTS)
        ├── Git + its own SSH key → GitHub
        ├── nvm → Node.js + npm
        └── ~/devops-lab  (the repo)
```

**Why Linux?** Docker, Kubernetes, Terraform, and almost every DevOps tool are built for Linux, and CI runners and servers run Linux. Developing in Linux means commands and behavior match CI and production.

**Why a separate distro?** Isolation, also called limiting the *blast radius*. The work distro has its own Git identity, repos, and later its own Kubernetes config. If both lived in one distro, a lab command could hit a work system (for example, `kubectl` pointed at the company cluster). With separate distros, neither environment can damage the other.

---

## Step 1: Create the isolated distro (PowerShell)

See what can be installed:

```powershell
wsl --list --online
```

Install Ubuntu 26.04 LTS under its own name:

```powershell
wsl --install -d Ubuntu-26.04 --name devops-lab
```

- `-d Ubuntu-26.04` picks the distro. It is an LTS release (years of security updates) and matches the work distro's version.
- `--name devops-lab` gives it an unmistakable name.

When it finishes, create a Linux username and password. **Store the password in a password manager**: `sudo` needs it constantly.

**Check:**

```powershell
wsl --list --verbose
```

`devops-lab` should be listed with `VERSION 2`. The default (`*`) stays on the work distro on purpose, so nothing changes for work.

> **Forgot the Linux password?** WSL trusts your Windows account, so you can reset it: `wsl -d devops-lab -u root`, then `passwd <your-linux-user>`, then `exit`. This also means Linux security is only as strong as your Windows login.

---

## Step 2: Open the distro in the right folder (Windows Terminal)

Launching WSL from PowerShell starts in your Windows folder (`/mnt/c/Users/...`). **Always work in the Linux home folder (`~`) instead.** Files under `/mnt/c` cross the Windows/Linux boundary, which makes Git and npm very slow and makes file permissions unreliable.

Make the distro always open at home:

1. Open **Terminal** (Windows key → type `Terminal`).
2. **Ctrl + ,** opens Settings.
3. Under **Profiles**, select **devops-lab**. If it is missing (this can happen with custom-named distros), click **Add a new profile → New empty profile** and name it `devops-lab`.
4. Set **Command line** to:
   ```
   wsl.exe -d devops-lab --cd ~
   ```
5. **Save.**

**Check:** open it via the **⌄** next to the **+** tab button. The prompt ends in `~$`.

Do not put `cd ~` in `~/.bashrc` instead: it runs for every shell, so it would also yank VS Code's terminal out of the project folder.

---

## Step 3: Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

- `sudo` runs a command as administrator (root) and asks for your Linux password. Nothing appears while typing.
- `apt` is Ubuntu's package manager. `update` refreshes the package list, `upgrade -y` installs newer versions.
- `&&` runs the second command only if the first succeeded.

---

## Step 4: Configure Git

Git stamps a name and email onto every commit, and in a public repo anyone can read them. Use GitHub's private noreply address: **GitHub → Settings → Emails** (keep "Keep my email addresses private" enabled).

```bash
git --version          # install with: sudo apt install -y git   (if missing)
git config --global user.name "Bende-KBB"
git config --global user.email "283937475+Bende-KBB@users.noreply.github.com"
git config --global init.defaultBranch main
```

- `--global` writes to `~/.gitconfig` **of this distro only**. The work distro is unaffected.
- `init.defaultBranch main` names the first branch `main` in repos created with `git init`. Cloned repos keep their existing branch names.

**Check:** `git config --global --list`

---

## Step 5: SSH key for GitHub

An SSH key pair proves your identity without sending a password:

- **Private key** (`~/.ssh/id_ed25519`): never leaves this machine. Never paste, share, or commit it.
- **Public key** (`~/.ssh/id_ed25519.pub`): given to GitHub.

This distro gets **its own key**, separate from the work distro's. One key per environment means one can be revoked without affecting the other.

```bash
ssh-keygen -t ed25519 -C "283937475+Bende-KBB@users.noreply.github.com"
```

Accept the default location and **set a passphrase** (store it in a password manager).

Show the **public** key and copy the whole line:

```bash
cat ~/.ssh/id_ed25519.pub
```

GitHub → **Settings → SSH and GPG keys → New SSH key**. Title: `devops-lab WSL`, type: Authentication Key. Paste, save.

**Check:**

```bash
ssh -T git@github.com
```

On first connect, SSH shows GitHub's host fingerprint. **Before typing `yes`, compare it** with GitHub's published list (search "GitHub's SSH key fingerprints"). The ED25519 one is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`. A mismatch would mean you are not talking to the real GitHub. After `yes`, it is saved in `~/.ssh/known_hosts`.

Success: `Hi Bende-KBB! You've successfully authenticated, but GitHub does not provide shell access.` (No shell access is normal.)

---

## Step 6: Node.js via nvm

**Why nvm?** Projects need different Node versions. nvm installs them side by side, and the project will pin its version in a file so this machine, CI, and the Docker image all use the same one. Version mismatch is a top cause of "works on my machine, fails in CI."

Copy the install command from the official README at `https://github.com/nvm-sh/nvm` ("Installing and Updating"). Its shape:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/vX.Y.Z/install.sh | bash
```

`curl ... | bash` downloads a script and runs it immediately. **Always pause at this pattern.** Acceptable here only because the source is official and the version is pinned.

Close the terminal and open a new **devops-lab** tab so the shell loads nvm, then:

```bash
nvm --version          # e.g. 0.40.8
nvm install --lts      # LTS = Long-Term Support, recommended for real projects
node -v                # e.g. v24.22.1
npm -v                 # e.g. 11.19.1
```

---

## Step 7: Clone the repo

```bash
cd ~
git clone git@github.com:Bende-KBB/devops-lab.git
cd devops-lab
```

Use the **SSH URL** (`git@github.com:`), not `https://`, so Git authenticates with the SSH key. The repo is cloned directly into the home folder: this distro exists for one project, so no extra `projects/` folder is needed.

**Check:**

```bash
ls -la          # .git, .gitignore, README.md
git remote -v   # origin  git@github.com:Bende-KBB/devops-lab.git (fetch/push)
```

`.git` is Git's own database for the repo. `origin` is the conventional name for the remote you cloned from.

---

## Step 8: Connect VS Code

1. In VS Code on Windows, install the **WSL** extension (by Microsoft) if missing.
2. In the devops-lab terminal:
   ```bash
   cd ~/devops-lab
   code .
   ```

VS Code's window runs on Windows, while a server inside the distro reads files and runs terminals and extensions.

**Check:** the bottom-left corner shows **WSL: devops-lab**, not `WSL: Ubuntu`. Extensions installed here are separate from the work distro.

---

## Final verification

From `~/devops-lab`:

```bash
node -v                          # an LTS version
git config --global user.email   # the noreply address
git remote -v                    # git@github.com:Bende-KBB/devops-lab.git
ssh -T git@github.com            # "Hi Bende-KBB!"
```

All pass → environment ready.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Prompt shows `/mnt/c/...` | Opened from PowerShell without `--cd ~` | Use the Terminal profile, or run `cd ~` |
| Commands run against the wrong environment | Opened the work `Ubuntu` instead of `devops-lab` | Check the prompt's username and VS Code's bottom-left corner |
| `nvm: command not found` | Shell hasn't loaded nvm | Open a new tab, or `source ~/.bashrc` |
| `Permission denied (publickey)` | GitHub lacks the public key, or the private one was pasted | Redo Step 5 with the `.pub` file |
| `git clone` asks for username/password | HTTPS URL used | Clone with `git@github.com:` |
| `code: command not found` | WSL extension missing | Install it, then open a new tab |
| `devops-lab` profile missing in Terminal | Not auto-generated for custom-named distros | Create it manually (Step 2) |

---

## Decisions behind this setup

To be recorded as ADRs in `docs/adr/`:

- **WSL2 instead of native Windows:** DevOps tooling is Linux-native; CI and servers run Linux.
- **Dedicated distro instead of sharing the work distro:** isolates Git identity, credentials, and cluster access.
- **SSH instead of HTTPS for Git:** same model as server access; no stored passwords or tokens.
- **nvm instead of a system Node install:** per-project version pinning that matches CI and containers.
