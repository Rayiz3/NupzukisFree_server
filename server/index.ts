import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import dotenv from "dotenv";


interface userType {
  id: number;
  email: string;
  name: string;
  passward: string;
  createdAt: Date;
  keys: string[];
  map: mapType[];
}

interface mapType {
  name: string;
  id: number;
  createdAt: Date;
  creatorEmail: string;
  rating: number;
  config: number[];
}

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const CLIENT_DOMAIN = process.env.CLIENT_URL;
const SERVER_DOMAIN = process.env.SERVER_URL;
const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
const PORT = process.env.PORT;
const KAKAO_REDIRECT_URI = `${SERVER_DOMAIN}/auth/kakao/callback`;

app.use(cors({
  origin: CLIENT_DOMAIN,
  credentials: true
}));
app.use(express.json());

//////// users ////////

app.route('/users')
  .get(async (req, res) => {
    const users = await prisma.user.findMany({
      include: {
        Map: true, // include the realted Map for each user
      },
    });
    res.status(200).json(users);
  })

  .post(async (req, res) => {
    try {
      const { email, name, passward }: userType = req.body;
      const newUser = await prisma.user.create({
        data: {
          // id : default - auto increment
          email,
          name,
          passward,
          // createdAt : default - auto timestamp
          // keys : default - ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', '2', '3']
          // Map : default - []
        },
      });
      res.status(201).json({newUser});
    } catch (error) {
      res.status(500).json({
        message: "[Error] An error occurred while adding the user"
      });
    }
  });

//////// user ////////

app.route('/user')
  .get(async (req, res) => {
    try {
      if (req.query.email){
        const foundUser = await prisma.user.findFirst({
          where: {
            email: req.query.email.toString(),
          },
        });
        res.status(200).json(foundUser);
      }
      else {
        res.status(400).json({
          message: "[Error] email not provided",
        })
      }
    } catch (error) {
      res.status(500).json({
        message: "[Error] An error occurred while looking for the user with email",
      });
    }
  });

//////// maps ////////

app.route('/maps')
  .get(async (req, res) => {
    try {
      if (req.query.email){
        const foundmaps = await prisma.map.findMany({
          where: {
            creatorEmail: req.query.email.toString()
          }
        });
        res.status(200).json(foundmaps);
      }
      else {
        const maps = await prisma.map.findMany();
        res.status(200).json(maps);
      }
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch maps"
      });
    }
  })

  .post(async (req, res) => {
    try {
      const { name, creatorEmail, config }: mapType = req.body;
      // Create a new map in the database
      const newMap = await prisma.map.create({
        data: {
          name,
          config,
          creator: {
            connect: {
              email: creatorEmail // Connect to the existing user
            },
          },
        },
      });
  
      res.status(201).json({
        message: "Map added successfully: " + newMap.name,
        map: newMap,
      });
    } catch (error) {
      console.error("[Error] Failed to add map:", error);
      res
        .status(500)
        .json({ message: "[Error] An error occurred while adding the map" });
    }
  });

app.post("/maps/email", async (req, res) => {
  try {
    const { email } = req.body;
    const maps = await prisma.map.findMany({
      where: {
        creatorEmail: email
      }
    });
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching maps:", error);
    res.status(500).json({
      message: "[Error] An error occurred while looking for the maps"
    });
  }
});

app.get("/maps/amount", async (req, res) => {
  try {
    if(req.query.email){
      const mapCount = await prisma.map.count({
        where: {
          creatorEmail: req.query.email.toString()
        }
      });
      res.status(200).json({mapCount});
    }
    else {
      const mapCount = await prisma.map.count();
      res.status(200).json({mapCount});
    }
  } catch (error) {
    res.status(500).json({
      message: "[Error] An error occurred while getting the map amount"
    });
  }
})

//////// map ////////

app.get("/map", async (req, res) => {
  try {
    if (req.query.id){
      const foundMap = await prisma.map.findFirst({
        where: {
          id: parseInt(req.query.id.toString()),
        },
      });
      res.status(200).json(foundMap);
    }
    else {
      res.status(400).json({
        message: "[Error] id not provided",
      })
    }
  } catch (error) {
    res.status(500).json({
      message: "[Error] An error occurred while looking for the map with id",
    });
  }
});

app.patch("/map/rating", async (req, res) => {
  try {
    const { id, increment } = req.body;
    const foundMap = await prisma.map.findFirst({
      where: {
        id: id
      }
    })
    if (foundMap) {
      const map = await prisma.map.update({
        where: {
          id: id,
        },
        data: {
          rating: foundMap.rating + increment,
        }
      });
      res.status(200).json(map);
    }
    else {
      res.status(404).json({
        message: "[Error] Map not found"
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "[Error] An error occurred while updating the map rating"
    });
  }
});

//////// keys ////////

app.put("/keys", async (req, res) => {
  try {
    const { email, keys } = req.body;
    const updatedUser = await prisma.user.update({
      where: {
        email: email
      },
      data: {
        keys : keys,
      },
    });
    res.status(200).json({
      message: "Keys updated successfully",
      updatedKeys: updatedUser.keys
    });
  } catch (error) {
    res.status(500).json({
      message: "[Error] An error occurred while updating the keys"
    });
  }
});

app.get("/auth/kakao", (req, res) => {
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
  res.redirect(kakaoAuthUrl);
});

app.get("/auth/kakao/callback", async (req, res) => {
  const { code } = req.query;
  try {
    // 1. get the acess token
    const tokenResponse = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          client_id: KAKAO_CLIENT_ID,
          redirect_uri: KAKAO_REDIRECT_URI,
          code,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. get the user information
    const userInfoResponse = await axios.get(
      "https://kapi.kakao.com/v2/user/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const { id, kakao_account } = userInfoResponse.data;

    // 3. check for existing user or create a new one
    let user = await prisma.user.findFirst({
      where: { email: kakao_account.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: kakao_account.email,
          name: kakao_account.profile.nickname,
          passward: `kakao-${id}`, // Placeholder password for Kakao users
        },
      });
    }

    const redirectUrl = `${CLIENT_DOMAIN}/?email=${encodeURIComponent(
      user.email
    )}`;
    res.redirect(redirectUrl);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Axios error during Kakao Login:",
        error.response?.data || error.message
      );
      res.status(500).json({
        message: "Kakao Login failed 1",
        error: error.response?.data || error.message,
      });
    } else if (error instanceof Error) {
      console.error("Generic error during Kakao Login:", error.message);
      res
        .status(500)
        .json({ message: "Kakao Login failed 2", error: error.message });
    } else {
      console.error("Unknown error during Kakao Login:", error);
      res
        .status(500)
        .json({ message: "Kakao Login failed 3", error: "Unknown error" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${SERVER_DOMAIN}`);
});
