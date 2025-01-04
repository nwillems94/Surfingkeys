This is a bare-bones version of the [SurfingKeys](https://github.com/brookhong/Surfingkeys/) extension. For detailed documentation, refer to the original repository. 

# What
The purpose of this fork is minimize code, dependencies, and permissions. This fork is focused on preserving only the utilities that make navigating your browser with a keyboard easy. As many permissions as possible have been dropped from the original (history, bookmarks, downloads, topSites, clipboardRead, and clipboardWrite permissions have all been removed). Part of what makes this possible is the use of system shortcuts over Vim ones, where intuitive (e.g., use Ctrl-C to copy or Ctrl-Tab to cycle tabs; use browser shortcut keys to open downloads or search). 

The commit history details the removal of certain features. They can (in theory) be added back in by removing the offending commits. The following features have been removed:

- documentation
- tests
- pdf viewer
- markdown viewer
- emoji
- neovim
- search
- omnibar
- proxy

# Why
This fork was created partly because of this [issue](https://github.com/brookhong/Surfingkeys/issues/1796) and partly because the original extension had many features I did not need. There is nothing wrong with the additional features, but it makes auditing the code more difficult. There are fewer features here than the upstream (the only addition is the ability to open links in incognito tabs), that is the point. 

You can build this extension yourself (`npm run build:prod`) then pack and install it locally (for example, for [MS edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-manage-extensions-webstore)).
