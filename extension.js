/* exported init, enable, disable, _onKeyPressEvent, _onKeyReleaseEvent */

/*
 * Copyright (C) 2015 Jonny Lamb <jonnylamb@jonnylamb.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */
const Lang = imports.lang;

const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Tweener = imports.ui.tweener;
const Main = imports.ui.main;

// Import the convenience.js (Used for loading settings schemas)
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

// Import config
const config = Me.imports.config;

function init() {
    this.visible = true;

    this.settings = Convenience.getSettings();
    // Catch use shortcut toggle config change
    this.settings.connect('changed::' + config.SETTINGS_USE_TOGGLE_SHORTCUT, Lang.bind(this, refresh_keybindings));
}

function enable() {
    if (this.settings.get_boolean(config.SETTINGS_USE_TOGGLE_SHORTCUT)) {
        add_keybindings(config.SETTINGS_TOGGLE_SHORTCUT, toggle_tray);
    }

    /* Remove current barrier. */
    Main.legacyTray._unsetBarrier();

    /* Disable barriers; we won't need them. */
    Main.legacyTray._horizontalBarrier = null;
    Main.legacyTray._syncBarrier = function () { };

    /* Add custom borders. */
    Main.legacyTray._box.add_style_class_name('middle-legacy-tray');
    Main.legacyTray._iconBox.add_style_class_name('middle-legacy-tray-icon-box');

    /* Remove hide/show controls from the tray. */
    Main.legacyTray._box.remove_child(Main.legacyTray._concealHandle);
    Main.legacyTray._box.remove_child(Main.legacyTray._revealHandle);

    /* Create a close button. Mimic Main.legacyTray._revealHandle. */
    let close_button = new St.Button({ style_class: 'legacy-tray-handle' });
    close_button.child = new St.Icon({ icon_name: 'close-symbolic' });
    close_button.child.add_style_class_name('close-button');
    close_button.connect('clicked', Lang.bind(this, hide_tray));

    /* Remove the slider. */
    Main.layoutManager.untrackChrome(Main.legacyTray._slider);
    Main.legacyTray._slider.remove_actor(Main.legacyTray._box);
    Main.legacyTray.actor.remove_actor(Main.legacyTray._slider);

    /* Reorder the box so that close_button is first. */
    Main.legacyTray._box.remove_child(Main.legacyTray._iconBox);
    Main.legacyTray._box.add_child(close_button);
    Main.legacyTray._box.add_child(Main.legacyTray._iconBox);

    /* Replace the slider with the box. */
    Main.legacyTray.actor.add_actor(Main.legacyTray._box);

    // TODO: necessary?
    Main.layoutManager.trackChrome(Main.legacyTray._box, { affectsInputRegion: true });

    /* Set alignments to the center of the screen. */
    Main.legacyTray.actor.set_x_align(Clutter.ActorAlign.CENTER);
    Main.legacyTray.actor.set_y_align(Clutter.ActorAlign.CENTER);

    /* Setup keyboard events. */
    Main.legacyTray._box.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
    Main.legacyTray._box.connect('key-release-event', Lang.bind(this, this._onKeyReleaseEvent));
    Main.legacyTray._box.can_focus = true;

    hide_tray();
}

function disable() {
    remove_keybindings(config.SETTINGS_TOGGLE_SHORTCUT);
    show_tray();
}

function show_tray() {
    this.visible = true;

    Main.legacyTray.actor.show();

    // Get focus so 'Escape' can close.
    Main.legacyTray._box.grab_key_focus();

    Tweener.addTween(Main.legacyTray.actor, {
        opacity: 255,
        time: 1,
        transition: 'easeOutQuad',
        onComplete: Lang.bind(this, function () {
        })
    });
}

function hide_tray() {
    this.visible = false;

    Tweener.addTween(Main.legacyTray.actor, {
        opacity: 0,
        time: 0.5,
        transition: 'easeOutQuad',
        onComplete: Lang.bind(this, function () {
            Main.legacyTray.actor.hide();
        })
    });
}

function toggle_tray() {
    if (this.visible) {
        hide_tray();
    } else {
        show_tray();
    }
}

function add_keybindings(name, handler) {
    if (Main.wm.addKeybinding) {
        let ModeType = Shell.hasOwnProperty('ActionMode') ? Shell.ActionMode : Shell.KeyBindingMode;
        Main.wm.addKeybinding(name, this.settings, Meta.KeyBindingFlags.NONE, ModeType.NORMAL | ModeType.OVERVIEW, handler);
    } else {
        global.display.add_keybinding(name, this.settings, Meta.KeyBindingFlags.NONE, handler);
    }
}

function remove_keybindings(name) {
    if (Main.wm.removeKeybinding) {
        Main.wm.removeKeybinding(name);
    } else {
        global.display.remove_keybinding(name);
    }
}

function refresh_keybindings() {
    remove_keybindings(config.SETTINGS_TOGGLE_SHORTCUT);

    if (this.settings.get_boolean(config.SETTINGS_USE_TOGGLE_SHORTCUT)) {
        add_keybindings(config.SETTINGS_TOGGLE_SHORTCUT, toggle_tray);
    }
}

function _onKeyPressEvent(obj, event) {
    this._pressed_key = event.get_key_symbol();
    return Clutter.EVENT_PROPAGATE;
}

function _onKeyReleaseEvent(obj, event) {
    let pressed_key = this._pressed_key;
    this._pressed_key = null;

    let key = event.get_key_symbol();

    if (key !== pressed_key) {
        return Clutter.EVENT_PROPAGATE;
    }

    if (key === Clutter.Escape) {
        toggle_tray();
        return Clutter.EVENT_STOP;
    }

    return Clutter.EVENT_PROPAGATE;
}