// === CONFIGURATION ===
const invidiousInstances = [
    "https://inv.nadeko.net/",
    "https://yewtu.be/",
    "https://invidious.f5.si/",
    "https://invidious.nerdvpn.de/",
    "https://inv.perditum.com/"
];
const channelId = "UCiFOL6V9KbvxfXvzdFSsqCw";
const timestampRegex = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/;

const flavor = [
    "because the comments on ken's videos are just so funny",
    "because none of you are funny",
    "i made this site in an hour",
    "notice me daddy kenneth",
    "to leak elixir from his evo pump",
    "to leak goblin curse from his evo log",
    "2.4 ken comment cycle",
    "to goon to 3 musketeers",
    "ken the type of guy :skull:",
    "jiddy kong could never",
    "to hit 1 mil subscribers",
    "to go “inferno beam” while killing ants with a magnifying glass",
    "to help a kid being bullied and then be his best friend :)",
    "to yell “evo goblin cage value!” as he watches the predator next door lure in his next victim",
    "to mention that goblin curse amplfies damage in a eulogy",
    "to throw a banana peel into the path of a person he doesn't like and watch him slip",
    "to be scared of women",
    "to have an apple core, a fish skeleton, and a banana peel in his trash can",
    "Ken pours cereal into a bowl. The flakes crackle as the milk hits them. On the box, a cartoon tiger proclaims ‘They’re grrrreat’. Ken chews slowly, with empty eyes. ‘They’re fine’ he whispers ‘everything’s just fine’",
    "Ken builds a new deck. He drags each card with care, like placing flowers on a grave. He stares at the screen. ‘This one... this one will work.’ It doesn't. But he knew that already.",
    "Ken walks home from the cinema, alone, his mind casting back to the screening of Barbie. ‘I'm Kenough,’ he remembers the characters say, content with their place in the world. ‘Good for them,’ Ken mutters. He watches, silently, as droplets of rain pummel the pavement. ‘But I still feel like Kenothing.’"
]

let player;
let currentVideo = null;
let isLoading = false;
let allVideos = [];

// === UTILITY FUNCTIONS ===
function getRandomItem(array)
{
    return array[Math.floor(Math.random() * array.length)];
}

function parseTimestamp(str)
{
    const parts = str.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

async function fetchFromInstances(path)
{
    for (const base of invidiousInstances)
    {
        try
        {
            const resp = await fetch(base + path, { mode: "cors" });
            if (!resp.ok) throw new Error(`Bad status ${resp.status}`);
            const json = await resp.json();
            return json;
        }
        catch (err)
        {
            console.warn(`instance failed: ${base}`, err);
        }
    }
    throw new Error("All invidious instances failed");
}

async function fetchChannelVideos(maxPages)
{
    if (maxPages == 1)
    {
        const json = await fetchFromInstances(`api/v1/channels/${channelId}/videos`);
        return json.videos || json;
    }

    let allDaVideos = [];
    let continuation = null;
    let page = 1;

    while (page <= maxPages) // limit to avoid huge loops
    {
        const path = continuation
            ? `api/v1/channels/${channelId}/videos?continuation=${continuation}`
            : `api/v1/channels/${channelId}/videos`;

        const json = await fetchFromInstances(path);

        // some instances return videos directly, others under .videos
        const videos = json.videos || json || [];
        if (page == 1) allVideos = videos;
        else allVideos = allVideos.concat(videos);
        console.log(`${allVideos.length} videos fetched`);

        if (!json.continuation)
        {
            break; // no more pages
        }

        continuation = json.continuation;
        page++;
    }

    return allVideos;
}

async function fetchComments(videoId)
{
    try
    {
        const comments = await fetchFromInstances(`/api/v1/comments/${videoId}?count=100`);
        if (Array.isArray(comments)) return comments;
        if (comments.comments) return comments.comments;
    }
    catch (err)
    {
        console.warn("Primary comment fetch failed, trying fallback /videos/");
        try
        {
            const videoData = await fetchFromInstances(`/api/v1/videos/${videoId}?count=100`);
            return videoData.comments || [];
        }
        catch (err2)
        {
            console.error("Both comment endpoints failed", err2);
            return [];
        }
    }
    return [];
}

function pickTimestampComment(comments)
{
    const valid = comments.filter(c =>
    {
        const text = (c.content || c.text || "").replace(/<[^>]*>?/gm, "");
        return timestampRegex.test(text);
    });
    if (valid.length === 0) return null;
    return getRandomItem(valid);
}

// === MAIN LOGIC ===
async function loadRandomVideoAndComment()
{
    if (isLoading) return;
    isLoading = true;

    const nextButton = document.getElementById("nextButton");
    nextButton.textContent = "loading...";
    nextButton.disabled = true;

    try
    {
        const randomVideo = getRandomItem(allVideos);
        const videoId = randomVideo.videoId || randomVideo.id;
        if (!videoId) throw new Error("video id not found");

        const comments = await fetchComments(videoId);
        const commentObj = pickTimestampComment(comments);

        if (!commentObj)
        {
            console.warn("no timestamp comment found, retrying...");
            return loadRandomVideoAndComment();
        }

        const commentText = (commentObj.content || commentObj.text || "").replace(/<[^>]*>?/gm, "");
        const match = commentText.match(timestampRegex)[0];
        const seconds = parseTimestamp(match);

        const videoTitle = randomVideo.title || "untitled Video";
        const uploadDate = randomVideo.publishedText || new Date(randomVideo.published * 1000).toLocaleDateString();
        const authorName = commentObj.author || "unknown User";
        const authorAvatar = commentObj.authorThumbnails ? commentObj.authorThumbnails.slice(-1)[0].url : "";

        const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
        document.getElementById("copyButton").onclick = () => {
            navigator.clipboard.writeText(url);
            copyButton.textContent = "copied!";
            setTimeout(() => copyButton.textContent = "copy timestamp", 1500);
        };

        currentVideo = {
            id: videoId,
            title: videoTitle,
            uploadDate: uploadDate,
            comment: commentText,
            seconds: seconds,
            timestamp: match,
            authorName: authorName,
            authorAvatar: authorAvatar
        };

        displayVideoAndComment();
    }
    catch (err)
    {
        console.error("error loading video/comment:", err);
        setTimeout(() => loadRandomVideoAndComment(), 2000);
    }
    finally
    {
        isLoading = false;
        nextButton.textContent = "next";
        nextButton.disabled = false;
    }
}

function displayVideoAndComment()
{
    const { id, title, uploadDate, comment, authorName, authorAvatar, seconds, timestamp } = currentVideo;

    // Update video info above player
    document.getElementById("videoTitle").textContent = title;
    document.getElementById("videoUploadDate").textContent = `Uploaded: ${uploadDate}`;

    // Update comment section
    const commentTextEl = document.getElementById("commentText");
    const timestampInfoEl = document.getElementById("timestampInfo");
    const authorNameEl = document.getElementById("commentAuthorName");
    const authorAvatarEl = document.getElementById("commentAuthorAvatar");

    commentTextEl.textContent = `${comment}`;
    timestampInfoEl.textContent = `⏱ jumped to ${timestamp}`;
    authorNameEl.textContent = authorName;
    authorAvatarEl.src = authorAvatar || "";
    authorAvatarEl.style.display = authorAvatar ? "inline-block" : "none";

    // Load video
    if (!player)
    {
        player = new YT.Player("player",
        {
            height: "480",
            width: "854",
            videoId: id,
            playerVars: {
                start: seconds,
                rel: 0,
                modestbranding: 1
            },
            events: {
                onReady: event => event.target.seekTo(seconds, true),
                onError: event =>
                {
                    console.warn("player error, retrying...", event.data);
                    loadRandomVideoAndComment();
                }
            }
        });
    }
    else
    {
        player.loadVideoById({ videoId: id, startSeconds: seconds });
    }
}

function jumpToTimestamp()
{
    if (player && currentVideo)
    {
        player.seekTo(currentVideo.seconds, true);
    }
}

// === YT API ===
async function onYouTubeIframeAPIReady()
{
    await fetchChannelVideos(1).then((vids) =>
    {
        allVideos = vids;
        loadRandomVideoAndComment();

        // === EVENT LISTENERS ===
        document.getElementById("nextButton").addEventListener("click", () =>
        {
            loadRandomVideoAndComment();
        });

        document.getElementById("jumpButton").addEventListener("click", () =>
        {
            jumpToTimestamp();
        });

        console.log(`initial videos fetched (${allVideos.length}), getting all...`);
    });

    const flavorText = document.getElementById("flavorText");
    flavorText.textContent = getRandomItem(flavor);

    const vidFetch = 20;
    fetchChannelVideos(vidFetch);
}
