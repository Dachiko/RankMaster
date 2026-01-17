## Essence
1. You select the folder
2. It presents you two images side by side, you select the one you like more, it immediately shows the next pair.
3. It uses a sophisticated TrueSkill-like algorithm (Gaussian distribution) to calculate an objective ranking for every image in your folder to sort things out in as little matches as possible
4. It stores the data in a simple json file in the same directory
5. I'm thinking what to do with that data. For me it would work to rename all the filenames so that the leading number reflects the rank, but to reduce development cycles and debugging I want to proceed with the clear goal in mind. I need your ideas on what you'd like to do having all those files and a ranking data.

## More details:
- Two additional helping features: you can discard the image on the fly, the app will move the image file to the "discarded" folder (inside folder with images), plus it will make a database file and move the collected discarded image stats there, so that you can work on discarded images in a same manner if you like. I also added the ability to move the image to the "special 1" folder if you want to collect certain images along the process. Same process as with discarded, the file moves, the data follows. You can also revert the last discard or special with ctrl-z.
- You can do everything using hotkeys: left-right buttons to select one or another; "1" and "2" to choose which one to discard; "4" and "5" moves the image into special folder. "o" to open another folder, "esc" to immediately clean the window and finish the session. "s" to skip the pair.
- It remembers last opened folder and it will allow you to resume the session right away.
- To help you understand how close you are to converging, we have the progress bar based on overall confidence level, plus you will see green or red flash upon image choose which would tell you if you chose the favorite or an underdog in terms of current ranking. If you see a lot of green, it means the images are already in a good order.
- I really don't know what I'm doing by uploading it to github. I never published any software. I think the source files would allow you to build the exe file yourself, or if you are crazy enough to trust a random guy on the internet, try downloading the release and run it.

This contains everything (hopefully) you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
