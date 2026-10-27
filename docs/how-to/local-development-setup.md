# Local Development Environment Setup

**Applies to:** Windows 10/11 with WSL2
**Result:** An isolated Linux environment (`devops-lab`) with Git, GitHub SSH access, Node.js via nvm, this repository cloned, and VS Code connected to it.

Each step explains *what* it does and *why*, and ends with a check that confirms it worked before moving on.

Placeholders used below:

| Placeholder | Replace with |
|---|---|
| `<github-username>` | Your GitHub username |
| `<noreply-email>` | Your GitHub noreply address, from **GitHub → Settings → Emails** (format: `12345678+username@users.noreply.github.com`) |
| `<linux-user>` | The Linux username created in Step 1 |

---

## The big picture

```
Windows (host)
├── Windows Terminal  (with a "devops-lab" profile)
├── VS Code           (UI runs on Windows)
└── WSL2
    ├── <other distros>  ← e.g. a distro used for other work. Untouched.
    ├── docker-desktop   ← only if Docker Desktop is installed. Internal; never touch.
    └── devops-lab       ← this project's environment (Ubuntu 26.04 LTS)
        ├── Git + its own SSH key → GitHub
        ├── nvm → Node.js + npm (version from .nvmrc)
        └── ~/devops-lab  (the repository)
```

**Why Linux?** Docker, Kubernetes, Terraform, and almost every DevOps tool are built for Linux, and CI runners and servers run Linux. Developing in Linux means commands and behavior match CI and production.

**Why a dedicated distro?** Isolation, also called limiting the *blast radius*. Other distros on the same machine may hold other Git identities, credentials, repositories, and later Kubernetes configurations. If this project shared a distro with other work, a command meant for this project could hit another system (for example, `kubectl` pointed at the wrong cluster). With a dedicated distro, neither environment can affect the other.

---

## Step 1: Create the dedicated distro (PowerShell)

List installable distros:

```powershell
wsl --list --online
```

Install Ubuntu 26.04 LTS under its own name:

```powershell
wsl --install -d Ubuntu-26.04 --name devops-lab
```

- `-d Ubuntu-26.04` picks the distro. LTS (Long-Term Support) releases receive security updates for years.
- `--name devops-lab` gives it an unmistakable name. This option requires a recent WSL version; run `wsl --update` if it is rejected.

When the installation finishes, create a Linux username and password. **Store the password in a password manager**: `sudo` needs it constantly.

**Check:**

```powershell
wsl --list --verbose
```

`devops-lab` is listed with `VERSION 2`. The default distro (marked `*`) is deliberately left unchanged.

> **Forgotten Linux password?** WSL trusts the Windows account, so it can be reset: `wsl -d devops-lab -u root`, then `passwd <linux-user>`, then `exit`. This also means the Linux environment is only as secure as the Windows login.

---

## Step 2: Open the distro in the right folder (Windows Terminal)

Launching WSL from PowerShell starts in the Windows folder (`/mnt/c/Users/...`). **Always work in the Linux home folder (`~`) instead.** Files under `/mnt/c` cross the Windows/Linux boundary, which makes Git and npm very slow and file permissions unreliable.

Make the distro always open at home:

1. Open **Terminal** (Windows key → type `Terminal`).
2. **Ctrl + ,** opens Settings.
3. Under **Profiles**, select **devops-lab**. If it is missing (this can happen with custom-named distros), use **Add a new profile → New empty profile** and name it `devops-lab`.
4. Set **Command line** to:
   ```
   wsl.exe -d devops-lab --cd ~
   ```
5. **Save.**

**Check:** open the profile via the **⌄** next to the **+** tab button. The prompt ends in `~$`.

Do not put `cd ~` in `~/.bashrc` instead: `.bashrc` runs for every shell, so it would also move VS Code's integrated terminal out of the project folder.

---

## Step 3: Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

- `sudo` runs a command as administrator (root) and asks for the Linux password. Nothing appears while typing.
- `apt` is Ubuntu's package manager. `update` refreshes the package list; `upgrade -y` installs newer versions.
- `&&` runs the second command only if the first succeeded.

---

## Step 4: Configure Git

Git stamps a name and email onto every commit, and in a public repository anyone can read them. Use GitHub's noreply address, and keep **"Keep my email addresses private"** enabled under **GitHub → Settings → Emails**.

```bash
git --version   # if missing: sudo apt install -y git
git config --global user.name "<github-username>"
git config --global user.email "<noreply-email>"
git config --global init.defaultBranch main
git config --global pull.ff only
git config --global fetch.prune true
git config --global core.editor "code --wait"
```

| Setting | Effect |
|---|---|
| `--global` | Writes to `~/.gitconfig` **of this distro only**. Other distros are unaffected. |
| `user.name`, `user.email` | Identity recorded in every commit |
| `init.defaultBranch main` | Repositories created with `git init` start on `main`. Cloned repositories keep their branch names. |
| `pull.ff only` | `git pull` only fast-forwards. If local and remote history have diverged, it stops instead of silently creating a merge commit. |
| `fetch.prune true` | Every fetch (including the one inside `git pull`) removes references to branches deleted on GitHub. Local branches are never deleted. |
| `core.editor "code --wait"` | Git opens VS Code for commit messages and interactive rebases, and waits until the tab is closed. |

**Check:** `git config --global --list`

---

## Step 5: SSH key for GitHub

An SSH key pair proves an identity without sending a password:

- **Private key** (`~/.ssh/id_ed25519`): never leaves this machine. Never paste, share, or commit it.
- **Public key** (`~/.ssh/id_ed25519.pub`): given to GitHub.

This distro gets **its own key**, separate from keys in other environments. One key per environment means one can be revoked without affecting the others.

```bash
ssh-keygen -t ed25519 -C "<noreply-email>"
```

Accept the default location and **set a passphrase** (store it in a password manager).

Show the **public** key and copy the whole line:

```bash
cat ~/.ssh/id_ed25519.pub
```

On GitHub: **Settings → SSH and GPG keys → New SSH key**. Title: `devops-lab WSL`; type: Authentication Key. Paste and save.

**Check:**

```bash
ssh -T git@github.com
```

On first connection, SSH shows GitHub's host fingerprint. **Before typing `yes`, compare it** with GitHub's published list (search for "GitHub's SSH key fingerprints"). The ED25519 fingerprint is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`. A mismatch means the connection is not going to the real GitHub. After `yes`, the fingerprint is stored in `~/.ssh/known_hosts`.

Expected: `Hi <github-username>! You've successfully authenticated, but GitHub does not provide shell access.` (No shell access is normal.)

### Remember the passphrase with an SSH agent

Without an agent, SSH asks for the passphrase on every `git push` and `git pull`. **Do not remove the passphrase**: it keeps the key file encrypted, so a copied file (malware, stolen laptop, leaked backup) is useless on its own.

Instead, run an **SSH agent**: a background program that holds the *unlocked* key in memory while the file on disk stays encrypted. **keychain** starts one agent and shares it across all terminal tabs.

```bash
sudo apt install -y keychain
echo 'eval "$(keychain --eval --quiet --noask id_ed25519)"' >> ~/.bashrc
printf 'Host github.com\n  AddKeysToAgent yes\n' >> ~/.ssh/config
```

1. Installs keychain.
2. Appends a line to `~/.bashrc`, the script every new shell runs. `echo '...'` prints the text literally (single quotes prevent anything inside from running now); `>>` **appends** it to the file (a single `>` would overwrite the file). When the line later runs: `keychain --eval` starts the agent, or finds the running one, and prints commands that tell the shell where the agent is; `$( ... )` captures that output; `eval` executes it. `--noask` means "don't ask for the passphrase when the shell starts."
3. Appends two lines to `~/.ssh/config`, SSH's settings file. `printf` turns each `\n` into a line break. The rule says: for `github.com`, once the key is unlocked, hand it to the agent.

Result: opening a terminal asks nothing; the **first** Git command that contacts GitHub asks for the passphrase once; the rest of the WSL session is silent. After WSL shuts down (some time after the last terminal closes, or after a reboot), the next session asks once again.

Inspect the result: `tail -n 3 ~/.bashrc` and `cat ~/.ssh/config`.

**Check** (in a new tab):

```bash
ssh -T git@github.com   # asks for the passphrase
ssh -T git@github.com   # does not ask
```

---

## Step 6: Install nvm

**Why nvm?** Projects need specific Node.js versions. nvm installs versions side by side, and this repository pins its version in `.nvmrc`, so every machine, the CI pipeline, and the container image use the same one. A version mismatch is a common cause of "works on my machine, fails in CI."

The official installer is a script in the nvm repository (`https://github.com/nvm-sh/nvm`). **Pin it by full commit SHA, not by tag**: tags can be moved to different code, commits cannot.

1. On GitHub, open the nvm release to install (**Releases** → choose a version that is at least two weeks old).
2. Click the release's short commit ID to open the commit; the full 40-character SHA is in the URL.
3. Run the installer from that exact commit:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/<full-commit-sha>/install.sh | bash
```

`curl ... | bash` downloads a script and executes it immediately. **Always pause at this pattern**: it runs remote code with the current user's permissions. It is acceptable here only because the source is the official repository and the URL is pinned to an immutable commit.

Close the terminal and open a new **devops-lab** tab so the shell loads nvm.

**Check:**

```bash
nvm --version
git -C ~/.nvm rev-parse HEAD     # must equal <full-commit-sha>
git -C ~/.nvm status --short     # empty: nothing modified after install
```

---

## Step 7: Clone the repository and install Node.js

```bash
cd ~
git clone git@github.com:<github-username>/devops-lab.git
cd devops-lab
nvm install
```

- Use the **SSH URL** (`git@github.com:`), not `https://`, so Git authenticates with the SSH key.
- The repository is cloned directly into the home folder: this distro exists for one project, so no extra `projects/` folder is needed.
- `nvm install` without a version reads `.nvmrc`, downloads exactly that Node.js version, verifies it against the official checksums, and switches to it.

**Check:**

```bash
ls -la          # .git, .gitignore, .nvmrc, package.json, ...
git remote -v   # origin  git@github.com:<github-username>/devops-lab.git (fetch and push)
node -v         # same version as in .nvmrc
cat .nvmrc
```

`.git` is Git's database for the repository. `origin` is the conventional name for the remote the repository was cloned from.

---

## Step 8: Connect VS Code

1. In VS Code on Windows, install the **WSL** extension (by Microsoft) if missing.
2. In the devops-lab terminal:
   ```bash
   cd ~/devops-lab
   code .
   ```

VS Code's window runs on Windows, while a server inside the distro reads files and runs terminals and extensions.

**Check:** the bottom-left corner shows **WSL: devops-lab**, not another distro's name. Extensions installed here are separate from other distros.

---

## Final verification

From `~/devops-lab`:

```bash
node -v                          # equals the version in .nvmrc
git config --global user.email   # the noreply address
git remote -v                    # git@github.com:<github-username>/devops-lab.git
ssh -T git@github.com            # "Hi <github-username>!"
```

All pass → the environment is ready.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Prompt shows `/mnt/c/...` | Opened from PowerShell without `--cd ~` | Use the Terminal profile, or run `cd ~` |
| Commands affect the wrong environment | Another distro was opened instead of `devops-lab` | Check the prompt's username and VS Code's bottom-left corner |
| `wsl --install` rejects `--name` | Outdated WSL | `wsl --update`, then retry |
| `nvm: command not found` | The shell hasn't loaded nvm | Open a new tab, or `source ~/.bashrc` |
| `node -v` differs from `.nvmrc` | A different version is active | `nvm install` (or `nvm use`) inside the repository |
| `Permission denied (publickey)` | GitHub lacks the public key, or the private key was pasted | Redo Step 5 with the `.pub` file |
| `git clone` asks for a username and password | HTTPS URL used | Clone with `git@github.com:` |
| `code: command not found` | WSL extension missing | Install it, then open a new tab |
| `devops-lab` profile missing in Terminal | Not auto-generated for custom-named distros | Create it manually (Step 2) |

---

## Decisions behind this setup

To be recorded as ADRs in `docs/adr/`:

- **WSL2 instead of native Windows:** DevOps tooling is Linux-native; CI and servers run Linux.
- **A dedicated distro:** isolates Git identity, credentials, and cluster access from other work on the same machine.
- **SSH instead of HTTPS for Git:** the same model as server access; no stored passwords or tokens.
- **nvm with `.nvmrc` instead of a system-wide Node.js:** per-project version pinning that matches CI and container images.
- **Installers pinned by commit SHA:** tags are mutable; commits are not.
