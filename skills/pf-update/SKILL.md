---
name: pf-update
description: Update Planning Framework skills to the latest version from the framework source repo
version: 3.0.0
---

Update the installed Planning Framework skills to the latest version.

## Step 1: Find the framework source

Look for the planning-framework repo in common locations by running:
```
find ~/dev ~/projects ~/code /home -maxdepth 3 -name "update-skills.sh" -path "*/planning-framework/*" 2>/dev/null | head -5
```

If found, use that path. If not found, ask the user: "Where is the planning-framework repo on your machine?"

## Step 2: Run the update

Run the update script:
```
bash <path-to-planning-framework>/scripts/update-skills.sh
```

Show the output to the user ([new], [updated], [unchanged] per skill).

## Step 3: Report

Tell the user which skills were updated and confirm they are now active in this session.
