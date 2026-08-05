import { ImageFinder } from "./image-finder.js";
import * as FB from "../../FileTree/firebase.js";

FB.initialise();
FB.addAuthChangeListener((u) => {
    console.log("Auth change", u);
})

let ifind = new ImageFinder()
document.body.appendChild(ifind);
ifind.onImageSelected = (image) => {
    console.log("Image selected", image);
    ifind.remove();
}