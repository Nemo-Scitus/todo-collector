Building a TODO collector plugin for obsidian.

## Core frustration
No simple plug-in or tool in Obsidian that lists out all to-do items (indicated with '- [ ]') across the vault
Plug-ins like Dataview are too over-speced, plug-ins like Tasks add in emoji clutter and unnecessary detail

## Function
The plug-in is simple. It will collect all to-do items in the vault into one note called '_TODO.md'. These to-do items will be organised hierarchically according to the folder -> sub-folder -> ... -> note that they are found within. To-do items in a common note will be grouped under that note's header, then those in a common sub-folder under the header of that sub-folder etc.

The collected list will only be a copy of the line after the to-do indicator - [ ], so it is upon the user to add a date in the root to-do item, or an indication of urgency/priority.

### Optional
Changes in the collector will be written to the respective items in their notes, and vice-versa. Most recent update takes priority. This crucially allows you to check off items in the to-do collection and have that reflected in the notes.

