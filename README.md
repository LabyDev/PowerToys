<p align="center">
  <img src="./public/powertoys.svg" alt="Powertoys Logo" height="120" />
</p>

# Powertoys

A small collection of personal utilities built as a long-term passion project using Tauri.  

Originally started as Python tools nearly a decade ago, later refined and expanded with new features. See the early versions [here](/old/readme.md).

Supported platforms: Windows and Linux.


## Features

-  **Custom Background Support** \
Set a custom background image from the Settings page.  
The background can be selected or cleared at any time. Some appearance changes require a restart.

-  **Dark Mode** \
Supports dark mode, can be set.

Theme changes apply after restarting the application.

- **Language Support** \
Available in:
    - English  
    - German  
    - Dutch  
    - Polish  
    - Bosnian  


### File Randomiser

Randomly selects files from configured paths with filtering, bookmarking, presets, and optional tracking.


#### Overview

The workflow follows four stages:

1. Add Path  
2. Crawl  
3. Filter  
4. Pick  

The interface provides:

- Expandable path tree  
- Included and excluded counters  
- Global search across paths, files, and history  
- Timestamped open history  


#### Toolbar

- Add Path  
- Crawl  
- Next File  
- Random File  
- Shuffle  
- Tracking  
- Search  

When tracking is active, manual picking is disabled.


#### Filtering System

The Filters and Exclusions panel allows rule-based filtering.

##### Rule Types

- Contains  
- Starts With  
- Ends With  
- Regex  
- Bookmark  

Each rule can:

- Include (+)  
- Exclude (−)  
- Be case-sensitive  

Rules are evaluated in order and can be rearranged.

If no include rules exist, all files are included unless excluded.


#### Bookmarks

Files can be color-bookmarked.

- Click bookmark icon to cycle colors  
- Shift + Click to force a global bookmark  
- Global bookmarks apply across presets  
- Preset bookmarks are local  

Available colors:

- Red  
- Green  
- Gold  
- Blue  

Bookmarks can be referenced directly in filters.


#### Hidden Bookmark Filter Syntax

Trigger:

```
@bookmarks
```

Format:

```
@bookmarks[:global|:nonglobal][:color1,color2,...]
```

Options:

- `@bookmarks` required  
- `:global` only global bookmarks  
- `:nonglobal` only preset-local bookmarks  
- `:color1,color2,...` comma-separated colors  

Examples:

```
@bookmarks
@bookmarks:global
@bookmarks:nonglobal
@bookmarks:red
@bookmarks:global:red,blue
@bookmarks:nonglobal:green,yellow
```



#### Shuffle vs Sequential

- Shuffle enabled results in random selection  
- Shuffle disabled results in sequential traversal  

Sequential mode respects current filters and exclusions.



##### Randomness Level

A 0 to 100 slider controls how random selection feels:

- 0 strongly favors sequential order  
- 50 balanced default  
- 100 fully random  

Changes are saved automatically.



#### Process Tracking

Available on Windows only.

When enabled in settings and toggled in the toolbar:

- Closing a file automatically triggers the next selection  
- Respects shuffle mode  
- Manual picking is disabled while active  

Linux does not support process tracking.

Unstable or fast-closing applications may cause unexpected behavior. Like high RAM usage and system crashes.


#### Presets

Presets store:

- Paths  
- Filter rules  
- Shuffle state  
- Local bookmark state  

Available actions:

- Save  
- Save As  
- Rename  
- Clear  
- Open presets folder  

Unsaved changes are detected automatically.

### File Sorter

Organizes files inside a selected directory using name similarity.  
Everything is previewed first. Nothing happens until confirmed.

Fully undoable.



#### How It Works

1. Select a directory  
2. Build preview plan  
3. Adjust similarity threshold  
4. Review preview  
5. Execute sorting  
6. Optionally restore  



#### Similarity Matching

Files are grouped based on filename similarity without extensions.

- Compared against existing folders  
- If similarity meets the threshold, file moves into best match  
- If no match exists, a new folder is created  

When multiple folders match, the highest similarity wins.



#### Match Threshold

Adjustable from 10 percent to 100 percent.

- Lower values create more aggressive grouping  
- Higher values create stricter matching  
- 100 percent only matches near-identical names  

Preview updates automatically.


#### Preview

Live tree preview shows:

- Existing folders  
- New folders  
- Planned file moves  

Includes live search and real-time statistics:

- Files to move  
- Folders to create  
- Total folders affected  
- Total size to move  


#### Manual Controls

Per-file options:

- Exclude or Include  
- Force target folder  
- Reveal in file explorer  

All changes update the preview instantly.


#### Execution and Undo

When sorting:

- Folders are created as needed  
- Name collisions are handled safely  
- All moves are recorded  

The last operation can be restored at any time.


## License and Disclaimer

Licensed under the Laby’s Source-Available Passion License LSAPL v1.0.  
Personal, non-commercial use only. No redistribution of source or modified versions.

See the [LICENSE](./LICENSE) file for full terms.
