<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.0" name="dirt" tilewidth="48" tileheight="48" tilecount="1" columns="1">
 <properties>
  <property name="category" value="terrain"/>
  <property name="kind" value="ground"/>
  <property name="layer" value="ground"/>
  <property name="semantic" value="dirt"/>
 </properties>
 <image source="dirt.png" width="48" height="48"/>
 <wangsets>
  <wangset name="dirt_auto" type="edge" tile="0">
   <wangcolor name="dirt" color="#aa7744" tile="0" probability="1"/>
   <wangtile tileid="0" wangid="1,1,1,1,1,1,1,1"/>
  </wangset>
 </wangsets>
</tileset>
