import { Projection, Tile, WGS84BoundingBox } from "../src/projection";
import { buildLayerQuery, buildQuery, Config } from "../src/index";
import { expect } from "chai";
import {readFileSync} from "fs";
import { parse } from "@iarna/toml";

import "jest";

const proj = new Projection();
const testAssetsPath = "test/assets/";
const testOutputPath = "test/out/";

describe("buildLayerQuery", function () {
    it("simple layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string | null = buildLayerQuery({
            name: "source"
        },
            {
                name: "layer1",
                table: "table1"
            },
            bbox,
            13);
        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        256,
        true
        ) AS geom
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857))) as q)`);
    });

    it("simple layer with empty arrays", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string | null = buildLayerQuery({
            name: "source"
        },
            {
                name: "layer1",
                table: "table1",
                where: [],
                keys: []
            },
            bbox,
            13);
        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        256,
        true
        ) AS geom
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857))) as q)`);
    });

    it("full-featured layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string | null = buildLayerQuery({
            name: "source"
        },
            {
                name: "layer1",
                table: "table1",
                extend: 4096,
                buffer: 64,
                clip_geom: false,
                geom: "geometry",
                srid: 3857,
                keys: ["osm_id as id", "name"],
                where: ["TRUE"],
                minzoom: 10,
                postfix: "ORDER BY id",
                prefix: "DISTINCT ON(name)"
            },
            bbox,
            13);
        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT DISTINCT ON(name)ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        64,
        false
        ) AS geom, osm_id as id, name
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)) AND (TRUE)ORDER BY id) as q)`);
    });

    it("full-featured layer gets rejected due to minzoom", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string | null = buildLayerQuery({
            name: "source"
        },
            {
                name: "layer1",
                table: "table1",
                extend: 4096,
                buffer: 64,
                clip_geom: false,
                geom: "geometry",
                srid: 3857,
                keys: ["osm_id as id", "name"],
                where: ["TRUE"],
                minzoom: 10,
                postfix: "ORDER BY id"
            },
            bbox,
            9);
        expect(layerQuery).to.be.null;
    });

    it("layer with variant gets rejected due to minzoom", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string | null = buildLayerQuery({
            name: "source"
        },
            {
                name: "layer1",
                table: "table1",
                minzoom: 14,
                variants: [{
                    minzoom: 15
                }]
            },
            bbox,
            8);
        expect(layerQuery).to.be.null;
    });

    it("source-properties get propagated into layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string | null = buildLayerQuery({
            name: "source",
            geom: "geometry",
            extend: 4096,
            buffer: 64,
            clip_geom: false,
            srid: 3857,
            keys: ["osm_id as id", "name"],
            where: ["TRUE"],
            minzoom: 10,
            postfix: "ORDER BY id",
            prefix: "DISTINCT ON(name)"
        },
            {
                name: "layer1",
                table: "table1",
            },
            bbox,
            10);

        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT DISTINCT ON(name)ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        64,
        false
        ) AS geom, osm_id as id, name
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)) AND (TRUE)ORDER BY id) as q)`);
    });
})

describe("buildQuery", function () {
    it("simple query", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let config = <Config><unknown>parse(readFileSync(`${testAssetsPath}simple.toml`, "utf8"));
        let query: string|null = buildQuery("local", config, bbox, 13);
        let expected = readFileSync(`${testAssetsPath}simple_z13.sql`, "utf8")
            .replace(/!BBOX!/g, `${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}`)
            .replace(/\s+/g, ' ');
        expect(query).to.be.equal(expected);
    });
});