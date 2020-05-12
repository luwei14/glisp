(import "math.cljs")

(import-js-force "../js/lib_path.js")

(defn path? [a] (and (sequential? a) (= :path (first a))))

;; Shape functions

(defn path/rect
  {:doc  "Generates a rect path"
   :params [{:label "Pos" :type "vec2" :desc "coordinate of top-left corner of the rectangle"}
            {:label "Size" :type "vec2" :desc "size of the rectangle"}]
   :returns {:type "path"}
   :handles {:draw (fn [[[x y] [w h]]]
                     [; center
                      {:type "point" :id :center :class "translate" :pos (vec2/scale-add [x y] [w h] .5)}
                      ; edges
                      {:type "path" :id :left :path (line [x y] [x (+ y h)])}
                      {:type "path" :id :top :path (line [x y] [(+ x w) y])}
                      {:type "path" :id :right :path (line [(+ x w) y] (vec2/+ [x y] [w h]))}
                      {:type "path" :id :bottom :path (line [x (+ y h)] (vec2/+ [x y] [w h]))}
                      ; corners
                      {:type "point" :id :top-left :pos [x y]}
                      {:type "point" :id :top-right :pos [(+ x w) y]}
                      {:type "point" :id :bottom-left :pos [x (+ y h)]}
                      {:type "point" :id :bottom-right :pos (vec2/+ [x y] [w h])}])
             :on-drag (fn [{id :id p :pos dp :delta-pos} [pos size] [[_x _y] [_w _h]]]
                        (case id
                          :center [(vec2/+ [_x _y] dp) size]
                          :left  [[(+ _x (.x dp)) _y] [(- _w (.x dp)) _h]]
                          :top   [[_x (+ _y (.y dp))] [_w (- _h (.y dp))]]
                          :right [pos [(+ _w (.x dp)) _h]]
                          :bottom [pos [_w (+ _h (.y dp))]]
                          :top-left [p (vec2/- (vec2/+ [_x _y] [_w _h]) p)]
                          :top-right [[_x (.y p)] [(- (.x p) _x) (- (+ _y _h) (.y p))]]
                          :bottom-left [[(.x p) _y] [(- (+ _x _w) (.x p)) (- (.y p) _y)]]
                          :bottom-right [pos (vec2/- p [_x _y])]))}}
  [[x y] [w h]]
  [:path
   :M [x y]
   :L [(+ x w) y]
   :L [(+ x w) (+ y h)]
   :L [x (+ y h)]
   :Z])
(defalias rect path/rect)


(def path/circle
  ^{:doc "Generate a circle path"
    :params [{:label "Center" :type "vec2"  :desc "the centre of the circle"}
             {:label "Radius" :type  "number" :desc "radius o fthe circle"}]
    :handles {:draw (fn [[center radius] path]
                      [{:type "path" :id :radius :path path}
                       {:type "arrow" :id :radius
                        :pos (vec2/+ center [radius 0])}
                       {:type "point"
                        :id :center
                        :class "translate"
                        :pos center}])
              :on-drag (fn [{id :id p :pos} [center radius]]
                         (case id
                           :center [p radius]
                           :radius [center (vec2/dist center p)]))}}
  (let [K (/ (* 4 (- (sqrt 2) 1)) 3)]
    (fn [[x y] r]
      (let [k (* r K)]
        [:path
         :M [(+ x r) y]			 ; right
         :C [(+ x r) (+ y k)] [(+ x k) (+ y r)] [x (+ y r)] ; bottom
         :C [(- x k) (+ y r)] [(- x r) (+ y k)] [(- x r) y] ; left
         :C [(- x r) (- y k)] [(- x k) (- y r)] [x (- y r)] ; top
         :C [(+ x k) (- y r)] [(+ x r) (- y k)] [(+ x r) y] ; right
         :Z]))))
(defalias circle path/circle)

(defn path/line
  {:doc "Generates a line segment path"
   :params [{:type "vec2"}
            {:type "vec2"}]
   :handles {:draw (fn [[from to] path]
                     [{:type "path" :id :path :path path}
                      {:type "point" :id :from :pos from}
                      {:type "point" :id :to :pos to}])
             :on-drag (fn [{id :id p :pos dp :delta-pos} [from to]]
                        (case id
                          :path [(vec2/+ from dp) (vec2/+ to dp)]
                          :from [p to]
                          :to [from p]))}}
  [from to]
  [:path :M from :L to])

(defalias line path/line)

(def path/arc
  ^{:doc "Generate an arc path"
    :params [{:label "Center"
              :type "vec2"
              :desc "Coordinate of the arc's center"}
             {:label "Radius"
              :type "number"
              :desc "The arc's radius"}
             {:label "Start"
              :type "number"
              :desc "Angle to start the arc"}
             {:label "End"
              :type "number"
              :desc "Angle to stop the arc"}]
    :handles
    {:draw (fn [[center r start end]]
             [{:type "point"
               :id :center
               :pos center}
              {:type "point"
               :id :start
               :pos (vec2/+ center (vec2/dir start r))}
              {:type "point"
               :id :end
               :pos (vec2/+ center (vec2/dir end r))}])
     :on-drag (fn [{id :id p :pos} [center r start end]]
                (case id
                  :center `(~p ~r ~start ~end)
                  :start (let [start (vec2/angle (vec2/- p center))]
                           `(~center ~r ~start ~end))
                  :end (let [end (vec2/angle (vec2/- p center))]
                         `(~center ~r ~start ~end))))}}
  path/arc)
(defalias arc path/arc)

(defn path/polyline
  {:doc "Generates a polyline path"
   :params [& {:label "Vertex" :type "vec2"}]
   :handles {:draw (fn [[& pts]]
                     (concat
                      (map-indexed
                       (fn [i p] {:type "point"
                                  :id [:edit i]
                                  :pos p})
                       pts)
                      (map (fn [i] {:type "point"
                                    :id [:add (inc i)]
                                    :class "dashed"
                                    :pos (vec2/lerp (nth pts i)
                                                    (nth pts (inc i))
                                                    .5)})
                           (range (dec (count pts))))))
             :on-drag (fn [{id :id p :pos} [& pts]]
                        (let [[mode i] id]
                          (case mode
                            :edit (replace-nth pts i p)
                            :add [:change-id [:edit i]
                                  (insert-nth pts i p)])))}}
  [& pts]
  (if (= 0 (count pts))
    [:path]
    (vec (concat :path
                 :M [(first pts)]
                 (apply concat (map #`(:L ~%) (rest pts)))))))
(defalias polyline path/polyline)

(defn path/polygon [& pts]
  (conj (apply polyline pts) :Z))
(defalias polygon path/polygon)

(defn path/ellipse
  {:doc "Generates an ellipse path"
   :params [{:type "vec2"}
            {:type "vec2"}]
   :handles {:draw (fn [[center [rx ry]] path]
                     [{:type "path" :guide true :path path}
                      {:type "arrow" :id :radius-x
                       :pos (vec2/+ center [rx 0])}
                      {:type "arrow" :id :radius-y
                       :pos (vec2/+ center [0 ry])
                       :angle HALF_PI}
                      {:type "point"
                       :id :center
                       :class "translate"
                       :pos center}])
             :on-drag (fn [{id :id p :pos} [center [rx ry]]]
                        (case id
                          :center [p [rx ry]]
                          :radius-x [center [(abs (- (.x p) (.x center))) ry]]
                          :radius-y [center [rx (abs (- (.y p) (.y center)))]]))}}
  [center radius]
  (->> (circle [0 0] 1)
       (path/scale radius)
       (path/translate center)))
(defalias ellipse path/ellipse)

(defn path/ngon
  {:doc "Generates a regular polygon"
   :params [{:type "vec2"}
            {:type "number" :constraints {:min 0}}
            {:label "# of Vertices" :type "number" :constraints {:min 3 :step 1}}]}
  [center radius n]
  (let [angles (column 0 n (/ TWO_PI n))
        vertices (map #(vec2/+ center (vec2/dir % radius)) angles)]
    (apply polygon vertices)))
(defalias ngon path/ngon)

(defn path/point
  {:doc "Generates a point path"
   :params [{:label "Pos" :type "vec2"}]}
  [p]
  [:path :M p :L p])
(defalias point path/point)

;; Path modifiers

(defn path/map-points
  {:doc "Maps each point in a path and returns a new one"
   :params [{:label "Function" :type "fn"}
            {:type "path"}]
   :returns {:type "path"}}
  [f path]
  (vec
   (apply concat :path (map (fn [[cmd & points]] `(~cmd ~@(map f points)))
                            (path/split-segments path)))))

(defn path/transform
  {:doc "Applies transforms for the vertex of input path"
   :params [{:type "mat2d"
             :type "path"}]
   :returns {:type "path"}}
  [transform path]
  (path/map-points #(vec2/transform-mat2d % transform) path))

(defn path/translate
  {:doc "Returns a translated path"
   :params [{:label "Value" :type "vec2"} {:type "path"}]
   :returns {:type "path"}}
  [t path]
  (path/map-points #(vec2/+ % t) path))

(defn path/translate-x [tx path]
  (path/map-points #(vec2/+ % [tx 0]) path))

(defn path/translate-x [ty path]
  (path/map-points #(vec2/+ % [0 ty]) path))

(defn path/scale [s path]
  (path/map-points #(vec2/* % s) path))

(defn path/scale-x
  {:doc "Returns a path scaled along x-axis"
   :params [{:label "Value" :type "vec2"} {:type "path"}]
   :returns {:type "path"}}
  [sx path]
  (path/map-points #(vec2/* % [sx 1]) path))

(defn path/scale-y [sy path]
  (path/map-points #(vec2/* % [1 y]) path))

(defn path/rotate [origin angle path]
  (path/map-points #(vec2/rotate origin angle %) path))

(defn path/merge
  {:doc "Returns a merged path"
   :params [& {:type "path"}]
   :returns {:type "path"}}
  [& paths]
  (vec (concat :path (apply concat (map rest paths)))))

;; Annotations for JS functions

(def path/trim
  ^{:doc "Trims a path by normalized range"
    :params [{:label "Start" :type "number" :constraints {:min 0 :max 1}}
             {:label "End" :type "number" :constraints {:min 0 :max 1}}
             {:label "Path" :type "path"}]
    :returns {:type "path"}
    :handles {:draw (fn [[start end path] trimmed-path]
                      [{:type "path" :id :path-original :class "dashed" :guide true :path path}
                       {:type "path" :id :path-trimmed :class "dashed" :guide true :path trimmed-path}
                       {:type "point" :id :start :pos (path/position-at start path)}
                       {:type "point" :id :end :pos (path/position-at end path)}])
              :on-drag (fn [{id :id p :pos} [start end path] [_ _ evaluated-path]]
                         (case id
                           :start [(path/nearest-offset p evaluated-path) end path]
                           :end [start (path/nearest-offset p evaluated-path) path]))}}
  path/trim)

(def path-boolean-meta
  {:params [& {:label "Path" :type "path"}]
   :handles {:draw (fn [[& paths]]
                     (vec (map #(hash-map :type "path" :guide true :class "dashed" :path %) paths)))}})


(def path/unite
  ^(assoc path-boolean-meta :doc "Unites the paths") path/unite)
(def path/intersect
  ^(assoc path-boolean-meta :doc "Intersects the paths") path/intersect)
(def path/subtract
  ^(assoc path-boolean-meta :doc "Subtracts the paths") path/subtract)
(def path/exclude
  ^(assoc path-boolean-meta :doc "Excludes the paths") path/exclude)
(def path/divide
  ^(assoc path-boolean-meta :doc "Divides the paths") path/divide)