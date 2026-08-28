import { SvgPlus } from "../SvgPlus/4.js";


class RadioSelection extends SvgPlus {
  #selected = null;
  #selectedValue = null;
  allowDeselect = false;
  constructor(el) {
    super(el);
  }

  select(value, triggerEvent = false) {
    for (const child of this.children) {
      let on = false;
      if (child.value === value) {
        if (this.allowDeselect) {
          this.#selected = null;
          this.#selectedValue = null;
        } else {
          this.#selected = child;
          this.#selectedValue = value;
          on = true;
        }
      }
      child.toggleAttribute("selected", on);
    }

    if (triggerEvent) {
      this.dispatchEvent(
        new CustomEvent("change")
      );
    }
  }

  onconnect() {
    for (let child of this.children) {
      if (child.hasBeenConnected) {
        continue;
      }
      child.addEventListener("click", this.select.bind(this, child.value, true));
      child.hasBeenConnected = true;
    }
  }

  get selected() {
    return this.#selectedValue;
  }
}

class Radio extends RadioSelection {
    constructor(children) {
        super("radio-selection");

        let selected = null;
        for (const [value, ...child] of children) {
            let el = this.createChild(...child)
            el.value = value;
            if (el.hasAttribute("selected")) {
                selected = value;
            }
        }

        this.select(selected);
        this.onconnect();
    }
}


export {RadioSelection, Radio};